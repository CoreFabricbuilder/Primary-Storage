# Optional Meraki snapshot collector

The cockpit opens directly from `index.html` without this collector. The collector runs on macOS only when you choose to gather a Dashboard snapshot. It uses built-in Keychain, curl and JavaScript for Automation. It has no local listener and makes only HTTPS GET requests to `api.meraki.com`.

## Prepare

1. In **Keychain Access**, create a new password item with name `Network Refresh Architecture Cockpit Meraki`, account equal to your macOS short username, and password equal to a Meraki API key with read-only access to the intended organization and network. Do not paste the key into a terminal command, browser field, or repository file.
2. Obtain the Meraki organization ID and network ID from Dashboard. Choose an output path in an existing directory **outside every Git repository**.
3. From Terminal, run:

   ```sh
   ./meraki-companion.sh --organization ORG_ID --network NETWORK_ID --output /absolute/path/outside/repository/meraki-snapshot.json
   ```

4. In the cockpit, open **Meraki Review**, select the snapshot JSON, map it to a branch, then stage. Inspect each candidate and choose **Apply as Observed** or **Dismiss**. Run deployment validation separately when ready.

The collector reads network details, network devices, organization device statuses filtered to the selected network, and wireless SSIDs. It rejects paginated responses rather than silently producing a partial snapshot. If the network has no wireless SSID endpoint, it marks SSID coverage unavailable. The saved snapshot contains only network ID/name, device serial/model/name, status, SSID name/enabled/VLAN, and collection metadata. The raw Dashboard responses live only in a private temporary directory during collection and are deleted when the collector exits. Keep snapshots and JSON backups in a protected local directory outside Git.

The browser imports only supported snapshot fields. A snapshot with a credential-named field is rejected. Staging retains candidate values and provenance, not the complete snapshot. Applying a candidate creates a sourced **Observed** record only; it never updates Design Intent, confirmation, a baseline, or an earlier validation run. The synthetic demonstration includes one staged snapshot so the review workflow can be explored without a Meraki account.
