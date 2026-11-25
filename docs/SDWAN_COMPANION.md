# Optional Catalyst SD-WAN Manager collector

The cockpit opens from `index.html` without this collector. On macOS, `sdwan-companion.sh` uses built-in `security`, `curl` and JavaScript for Automation to create a local, projected JSON snapshot. The browser never connects to Manager and receives no credentials. Use an account with read-only API permissions.

Store the Manager username and password as separate macOS Keychain generic passwords under services `Network Refresh Architecture Cockpit SD-WAN username` and `Network Refresh Architecture Cockpit SD-WAN password`. Use Keychain Access to create these items. Do not pass secrets on the command line or save them in a project file.

Run from a terminal on the Mac:

```sh
./sdwan-companion.sh --manager https://manager.example.com --site-id 101 --output /path/outside/Git/sdwan-site-101.json
```

The output path must be new and outside every Git repository. The collector posts credentials to `/j_security_check` for a session, then calls only fixed GET routes under `/dataservice`: `device`, bulk `ControlConnection`, `OMPPeer`, `BFDSessions`, `Interface`, `ControlWanInterface`, and optional `device/tloc` and `alarms`. It rejects incomplete paginated responses. An unavailable optional endpoint is marked uncovered; its validation remains Unknown. It stores only allowlisted facts for the selected site, excluding device configurations and API credentials. The raw response and session cookie live in a private temporary directory removed on exit. Keep the exported JSON private because topology and addressing can still be sensitive.

Open **Catalyst SD-WAN** in the app, select the JSON file, map its Cisco Site ID to a Branch or Campus site, and stage candidates. Review and Apply each candidate as Observed. Enter sourced architecture targets and run validation. This never changes Design Intent or confirms a fact. Import a newer snapshot and repeat review to use new observations.

API references reviewed for this implementation (Cisco Catalyst SD-WAN Manager): [20.16 authentication](https://developer.cisco.com/docs/sdwan/20-16/authentication/), [20.16 bulk device state](https://developer.cisco.com/docs/sdwan/20-16/bulk-api/), [20.16 getting started inventory](https://developer.cisco.com/docs/sdwan/20-16/getting-started/), [device TLOC status](https://developer.cisco.com/docs/sdwan/get-device-tloc-status/), and [device interface](https://developer.cisco.com/docs/sdwan/20-16/get-device-interface/). API fields and routes vary by Manager release; test against a nonproduction read-only account before relying on coverage. Template and central policy associations are shown only if returned in allowlisted inventory fields; otherwise they remain Unknown. No live Manager test was available in this repository.
