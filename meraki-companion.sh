#!/bin/bash
# Optional macOS read-only snapshot collector. No local server or browser credential access.
set -euo pipefail
set +x
umask 077

usage() { echo 'Usage: meraki-companion.sh --organization ID --network ID --output /absolute/path/snapshot.json' >&2; exit 2; }
organization='' network='' output=''
while (($#)); do
  case "$1" in
    --organization) (($# >= 2)) || usage; organization=$2; shift 2 ;;
    --network) (($# >= 2)) || usage; network=$2; shift 2 ;;
    --output) (($# >= 2)) || usage; output=$2; shift 2 ;;
    *) usage ;;
  esac
done
[[ $organization =~ ^[A-Za-z0-9_-]+$ && $network =~ ^[A-Za-z0-9_-]+$ && $output = /* ]] || usage
[[ -x /usr/bin/security && -x /usr/bin/curl && -x /usr/bin/osascript ]] || { echo 'macOS Keychain, curl and JavaScript for Automation are required for this optional companion.' >&2; exit 1; }
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

service='Network Refresh Architecture Cockpit Meraki'
account=$(/usr/bin/id -un)
api_key=$(/usr/bin/security find-generic-password -s "$service" -a "$account" -w) || {
  echo 'Meraki API key was not found in macOS Keychain.' >&2; exit 1;
}
[[ $api_key =~ ^[A-Za-z0-9_-]+$ ]] || { echo 'Keychain item has an invalid API key format.' >&2; exit 1; }
work=$(/usr/bin/mktemp -d "${TMPDIR:-/tmp}/meraki-snapshot.XXXXXXXX")
trap 'rm -rf "$work"' EXIT
base='https://api.meraki.com/api/v1'

get_json() {
  local path=$1 destination=$2 response
  response=$(printf 'header = "X-Cisco-Meraki-API-Key: %s"\n' "$api_key" | /usr/bin/curl \
    --config - --silent --show-error --proto '=https' --tlsv1.2 --max-time 45 \
    --request GET --dump-header "$work/headers" --output "$destination" \
    --write-out '%{http_code}' "$base$path") || { echo 'Meraki read failed.' >&2; exit 1; }
  if [[ $response == 404 && ${3:-} == optional ]]; then
    printf '[]' > "$destination"
    return 4
  fi
  if [[ $response != 200 ]]; then
    echo "Meraki read returned HTTP $response for $path." >&2
    exit 1
  fi
  if /usr/bin/grep -Eiq '^link:.*rel="?next"?' "$work/headers"; then
    echo 'Meraki response is paginated; snapshot was not written. Narrow the network or update this companion.' >&2
    exit 1
  fi
}

get_json "/networks/$network" "$work/network.json"
get_json "/networks/$network/devices?perPage=1000" "$work/devices.json"
get_json "/organizations/$organization/devices/statuses?networkIds%5B%5D=$network&perPage=1000" "$work/statuses.json"
ssid_coverage=true
get_json "/networks/$network/wireless/ssids" "$work/ssids.json" optional || {
  [[ $? == 4 ]] || exit 1
  ssid_coverage=false
}
generated_at=$(/bin/date -u '+%Y-%m-%dT%H:%M:%SZ')
staged="$work/snapshot.json"
/usr/bin/osascript -l JavaScript "$script_dir/meraki-companion.jxa.js" \
  "$work/network.json" "$work/devices.json" "$work/statuses.json" "$work/ssids.json" \
  "$organization" "$network" "$generated_at" "$ssid_coverage" > "$staged"
/bin/chmod 600 "$staged"
set -C
/bin/cat "$staged" > "$output" || { /bin/rm -f "$output"; echo 'Could not write snapshot.' >&2; exit 1; }
echo "Meraki snapshot saved to $output"
