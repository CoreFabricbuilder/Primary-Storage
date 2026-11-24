# Data model

The active workspace (`schemaVersion: 1`, `id: active`) contains a Programme and collections with stable IDs. Core entities are Domain, Site, Branch, Device, Interface, Circuit, VLAN, VRF, SD-WAN VPN, Subnet, Routing Adjacency, Service and Branch Pattern. `components` and `topologyLinks` provide the logical graph; `componentStates` map a component to Current, Transition or Future and its perspective, classification and source.

`lldReadiness` is one row per site, state and category (Physical, IP Addressing, VLAN, VRF, SD-WAN VPN, Routing, Security, Management, Patching, Optics and Services). Its status and evidence classification are independent. `decisions` include code, title, domain, status, decision, rationale, superseded decision, affected components, source, date and classification. `dependencies` link upstream and downstream components, state, status, decision and classification.

`sources`, `facts`, `evidence`, `validationRules` and `validationResults` preserve provenance and validation. Classification values are Unknown, Observed, Client Confirmed, Architect Confirmed, Inferred, Target and As-Built. Perspective values are Design Intent, Observed, Validated and As-Built. An observed or inferred fact is never promoted automatically.

Photographs are stored separately as IndexedDB Blobs, keyed by stable photo ID and linked to a branch and optional device. They carry name, type, timestamp, source label and Observed classification. Versioned JSON export encodes them as data URLs for portable backup. Import validates references and replaces workspace plus photos in one IndexedDB transaction.
