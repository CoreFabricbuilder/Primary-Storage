# Data model — schema 1

All primary keys are stable UUID strings supplied by the application layer. SQLite foreign keys are enabled per connection. The first migration creates:

| Area | Tables |
| --- | --- |
| Programme and location | `programme`, `domain`, `site`, `branch`, `branch_pattern` |
| Network inventory | `device`, `interface`, `circuit`, `vlan`, `vrf`, `sdwan_vpn`, `subnet`, `routing_adjacency` |
| Architecture | `service`, `architecture_decision`, `dependency` |
| Provenance and assurance | `source_document`, `architecture_fact`, `evidence`, `validation_rule`, `validation_result` |

`architecture_fact` records a subject, property, value, time horizon, perspective, and one classification: Unknown, Observed, Client Confirmed, Architect Confirmed, Inferred, Target, or As-Built. `evidence` links a fact to a source document or a manual evidence note. Source document paths, when used, are relative to the selected project directory. Validation results link rules to facts. Service dependencies use foreign keys on both endpoints.

The flexible `subject_kind` and `subject_id` pair in `architecture_fact` has no database foreign key; later write services must validate its target before insertion. The schema deliberately does not infer or promote classification. It contains no credential fields.
