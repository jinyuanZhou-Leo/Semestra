<!-- ⚠️ Once this folder changes, update me. -->

`Alembic` is now the backend's schema migration tool.
We no longer keep ad-hoc `ALTER TABLE` compatibility logic in `backend/main.py`; structural database changes should be expressed as versioned revisions under [`backend/alembic/versions/`](/Users/zhoujinyuan/Documents/Develop/Semestra/backend/alembic/versions/INDEX.md).

Current workflow:

```bash
cd backend
uv run alembic -c alembic.ini upgrade head
```

Create a new revision:

```bash
cd backend
uv run alembic -c alembic.ini revision -m "describe change"
```

Notes:

- The backend still calls `models.Base.metadata.create_all(...)` so an empty local SQLite database can bootstrap quickly during development and tests.
- Versioned schema evolution should go through Alembic revisions, not runtime startup code.
- The first revision added in this change removes persisted Todo `order_index` columns because Todo sorting is now a frontend-local preference instead of backend state.
