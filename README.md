# Excel Approval Sync Tool

A small standalone utility for preparing approval-line or hierarchy-field updates from an Excel workbook, then applying the generated plan through a logged-in web application session.

The tool is intentionally split into two parts:

1. A local Python script reads Excel data, applies skip rules and alias rules, and generates a review workbook plus a JSON plan.
2. A browser-side JavaScript runner is pasted into DevTools Console on the target web page. It uses the current logged-in browser session to dry-run or apply updates.

This repository does not include company data, employee data, API tokens, generated output files, or real alias mappings.

## What it can do

- Read a configured Excel sheet.
- Extract employee rows and approval-level columns.
- Normalize names and whitespace.
- Apply manually configured aliases.
- Skip unsafe or unresolved approver names.
- Generate a review workbook before any update.
- Generate a browser runner with the update plan embedded.
- Dry-run updates before applying them.
- Avoid overwriting existing non-empty fields by default.

## Folder Structure

```text
.
├── approval_sync_tool.py
├── browser_apply_runner.js
├── alias_config.example.json
├── requirements.txt
├── .gitignore
└── README.md
```

Generated files are written to `output/` and should not be committed.

## Setup

```powershell
python -m pip install -r requirements.txt
```

If your system uses the Python launcher:

```powershell
py -m pip install -r requirements.txt
```

## Configure aliases

Copy the example config:

```powershell
Copy-Item alias_config.example.json alias_config.json
```

Then edit `alias_config.json`.

Example:

```json
{
  "skipApprovers": ["Vacant", "TBD"],
  "aliases": [
    {
      "sourceApprover": "Source Name",
      "aliases": ["System Display Name", "Preferred Name", "Source Name"]
    }
  ]
}
```

## Generate an update plan

```powershell
python approval_sync_tool.py --source "C:\path\to\source.xlsx" --sheet "Sheet Name" --output-dir output
```

The script creates:

- `output/approval_sync_plan.json`
- `output/approval_sync_review.xlsx`
- `output/browser_runner_with_plan.js`

## Dry run in the browser

1. Open your target web app page and log in.
2. Open DevTools Console.
3. Paste the full content of `output/browser_runner_with_plan.js`.
4. Run:

```js
await window.runApprovalSync({ apply: false })
```

Check:

- `ready`: updates that can be applied.
- `alreadyCorrect`: values already matching the expected approver.
- `skipped`: rows that were not applied for safety reasons.
- `failed`: should be empty during dry run.

## Apply updates

Only apply after checking the dry-run result:

```js
await window.runApprovalSync({ apply: true })
```

Then verify again:

```js
await window.runApprovalSync({ apply: false })
```

A clean final result usually has:

```js
ready: 0
failed: 0
```

## Browser integration points

The browser runner is generic, but you must adapt these functions to your web app:

```js
loadEmployeeRecords()
updateEmployeeRecord(payload)
```

The included template assumes your web app exposes frontend service modules that can be imported from the browser page. If your app uses a different API pattern, update those two functions only.

## Safety Notes

Do not commit:

- Generated output files.
- Real employee data.
- Real approval plans.
- Real alias mappings if they contain personal data.
- Access tokens or copied request headers.

This tool does not bypass permissions. It runs with the same permissions as the logged-in user in the browser.
