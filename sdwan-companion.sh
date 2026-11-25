#!/bin/bash
# Optional macOS collector. All vendor data calls are GET; credentials stay in Keychain.
set -euo pipefail
set +x
umask 077
usage() { echo 'Usage: sdwan-companion.sh --manager https://manager.example.com --site-id NUMBER --output /absolute/path/snapshot.json' >&2; exit 2; }
manager='' site_id='' output=''
while (($#)); do
  case "$1" in
    --manager) (($# >= 2)) || usage; manager=$2; shift 2 ;;
    --site-id) (($# >= 2)) || usage; site_id=$2; shift 2 ;;
    --output) (($# >= 2)) || usage; output=$2; shift 2 ;;
    *) usage ;;
  esac
done
[[ $manager =~ ^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?$ && $site_id =~ ^[0-9]{1,10}$ && $output = /* ]] || usage
[[ -x /usr/bin/security && -x /usr/bin/curl && -x /usr/bin/osascript ]] || { echo 'macOS Keychain, curl and JavaScript for Automation are required.' >&2; exit 1; }
script_dir=$(cd "$(dirname "$0")" && pwd -P)
directory=$(dirname "$output")
[[ -d $directory && ! -e $output && ! -L $output ]] || { echo 'Choose a new output file in an existing directory.' >&2; exit 1; }
directory=$(cd "$directory" && pwd -P)
ancestor=$directory
while :; do
  if [[ -e $ancestor/.git ]]; then echo 'Choose an output directory outside every Git repository.' >&2; exit 1; fi
  [[ $ancestor == / ]] && break
  ancestor=$(dirname "$ancestor")
done
service='Network Refresh Architecture Cockpit SD-WAN'
username=$(/usr/bin/security find-generic-password -s "$service username" -w) || { echo 'SD-WAN username was not found in Keychain.' >&2; exit 1; }
password=$(/usr/bin/security find-generic-password -s "$service password" -w) || { echo 'SD-WAN password was not found in Keychain.' >&2; exit 1; }
[[ -n $username && -n $password ]] || { echo 'Keychain credentials are empty.' >&2; exit 1; }
work=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/sdwan-snapshot.XXXXXXXX")
trap 'rm -rf "$work"' EXIT
encode() { local v=$1 i byte; for ((i=0;i<${#v};i++)); do byte=$(printf '%s' "${v:i:1}" | /usr/bin/od -An -tx1 | /usr/bin/tr -d ' \n'); printf '%%%s' "$byte"; done; }
printf 'j_username=%s&j_password=%s' "$(encode "$username")" "$(encode "$password")" > "$work/login-body"
unset username password
response=$(/usr/bin/curl --silent --show-error --proto '=https' --tlsv1.2 --max-time 45 --cookie-jar "$work/cookies" --request POST --data-binary "@$work/login-body" --output "$work/login-response" --write-out '%{http_code}' "$manager/j_security_check") || { echo 'SD-WAN login failed.' >&2; exit 1; }
[[ $response == 200 || $response == 302 ]] || { echo "SD-WAN login returned HTTP $response." >&2; exit 1; }
if /usr/bin/grep -Eiq '<html|login|error' "$work/login-response"; then echo 'SD-WAN Manager rejected the session.' >&2; exit 1; fi
get_json() {
  local name=$1 path=$2 required=$3 status
  status=$(/usr/bin/curl --silent --show-error --proto '=https' --tlsv1.2 --max-time 60 --cookie "$work/cookies" --request GET --output "$work/$name.json" --write-out '%{http_code}' "$manager/dataservice/$path") || { echo "SD-WAN $name read failed." >&2; exit 1; }
  if [[ $status == 400 || $status == 404 || $status == 405 ]]; then
    if [[ $required == true ]]; then echo "Required SD-WAN $name endpoint is unavailable." >&2; exit 1; fi
    printf '{"data":[],"unavailable":true}' > "$work/$name.json"; return
  fi
  [[ $status == 200 ]] || { echo "SD-WAN $name read returned HTTP $status." >&2; exit 1; }
}
get_json inventory 'device' true
get_json control 'data/device/state/ControlConnection?count=10000' false
get_json omp 'data/device/state/OMPPeer?count=10000' false
get_json bfd 'data/device/state/BFDSessions?count=10000' false
get_json interfaces 'data/device/state/Interface?count=10000' false
get_json wan 'data/device/state/ControlWanInterface?count=10000' false
get_json tloc 'device/tloc' false
get_json alarms 'alarms' false
generated_at=$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')
/usr/bin/osascript -l JavaScript "$script_dir/sdwan-companion.jxa.js" "$work" "$site_id" "$manager" "$generated_at" > "$work/snapshot.json" || { echo 'SD-WAN response could not be projected safely.' >&2; exit 1; }
/bin/chmod 600 "$work/snapshot.json"
set -C
/bin/cat "$work/snapshot.json" > "$output" || { /bin/rm -f "$output"; echo 'Could not write snapshot.' >&2; exit 1; }
echo "SD-WAN snapshot saved to $output"
