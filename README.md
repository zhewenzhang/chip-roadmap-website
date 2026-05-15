# Agent Data Branch

This branch is used as a data inbox for scheduled agent jobs.

- `agent-inbox/company-intel/raw/`: raw company intelligence collected by scheduled agents
- `agent-inbox/company-intel/reviewed/`: reviewed and normalized company intelligence
- `agent-inbox/company-intel/approved/`: approved batches ready for admin import
- `agent-inbox/company-intel/state/`: run state for scheduled jobs

Do not deploy this branch. Do not write directly to Firestore from this branch.
