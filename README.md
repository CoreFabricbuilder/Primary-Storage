# Atlas Enterprise Architecture Workspace

A small, dependency-free application for mapping enterprise capabilities, applications, data assets, technology, and their relationships.

## Run

Requires Node.js 20 or later. From this repository:

```bash
npm start
```

Open `http://localhost:3000`. Set `PORT` to use another port. Run the model tests with `npm test`.

## What you can do

- Add, edit, search, filter, and remove architecture elements.
- Connect elements and inspect their relationships in the map.
- Track capability coverage by active applications and identify retiring elements.
- Import and export the whole workspace as JSON.

The app starts with sample architecture data. Changes are stored in your browser's local storage, so each browser has its own workspace. Export JSON regularly to back up or share a model. There is no server-side database or login.
