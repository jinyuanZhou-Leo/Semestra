#!/bin/bash
cd backend
uv run uvicorn main:app --reload
