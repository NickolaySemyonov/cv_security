from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from . import models
from . import schemas
from .database import engine, get_db

app = FastAPI(title="Configuration Service")

