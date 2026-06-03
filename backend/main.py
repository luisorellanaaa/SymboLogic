from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import desc
from passlib.context import CryptContext
from pydantic import BaseModel
from typing import List, Optional
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

import models
import database
from database import get_db, SessionLocal

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="Logica y Conjuntos API")

@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin_user:
        # Create default admin: admin / admin123
        hashed_password = pwd_context.hash("admin123")
        new_admin = models.User(username="admin", hashed_password=hashed_password, role=models.RoleEnum.ADMIN)
        db.add(new_admin)
        db.commit()
    db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

import sys

if hasattr(sys, '_MEIPASS'):
    base_dir = sys._MEIPASS
else:
    base_dir = os.path.dirname(os.path.dirname(__file__))

frontend_path = os.path.join(base_dir, "frontend")
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/")
def read_index():
    return FileResponse(os.path.join(frontend_path, "index.html"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "user" # user or admin

class ScoreCreate(BaseModel):
    game_mode: str
    score: int

class ScoreResponse(BaseModel):
    username: str
    game_mode: str
    score: int

    class Config:
        from_attributes = True

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == token).first() # Dummy token implementation (uses username as token for simplicity)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return user

@app.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    # Force role to always be USER to prevent self-registration as admin
    new_user = models.User(username=user.username, hashed_password=hashed_password, role=models.RoleEnum.USER)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User created successfully"}

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    # Simplistic token return (DO NOT use in real prod without JWT)
    return {"access_token": user.username, "token_type": "bearer", "role": user.role.value}

@app.post("/scores")
def save_score(score: ScoreCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_score = models.Score(user_id=current_user.id, game_mode=score.game_mode, score=score.score)
    db.add(new_score)
    db.commit()
    return {"message": "Score saved successfully"}

@app.get("/leaderboard", response_model=List[ScoreResponse])
def get_leaderboard(db: Session = Depends(get_db)):
    # Get top 3 overall, can be filtered by mode later
    scores = db.query(models.Score).order_by(desc(models.Score.score)).limit(3).all()
    
    result = []
    for s in scores:
        result.append(ScoreResponse(username=s.user.username, game_mode=s.game_mode, score=s.score))
    return result

@app.get("/stats")
def get_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    scores = db.query(models.Score).filter(models.Score.user_id == current_user.id).all()
    return {"username": current_user.username, "scores": [{"mode": s.game_mode, "score": s.score, "date": s.created_at} for s in scores]}
