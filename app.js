let gameSeq = [],
  userSeq = [];
let started = false,
  level = 0,
  isPaused = false;
let isPlayingSequence = false,
  soundEnabled = true;
let timer = 0,
  timerInterval;

// Reuse one AudioContext for the entire game
let audioContext = null;

const btns = ["red", "green", "yellow", "blue"];

const difficultySettings = {
  easy: { speed: 700, time: 12 },
  medium: { speed: 450, time: 9 },
  hard: { speed: 250, time: 6 },
};

let difficulty = "easy";
let highestScore = Number(localStorage.getItem("simonHighScore")) || 0;

const statusText = document.querySelector("#game-status");
const startBtn = document.querySelector("#start-btn");
const restartBtn = document.querySelector("#restart-btn");
const pauseBtn = document.querySelector("#pause-btn");
const soundBtn = document.querySelector("#sound-btn");
const gameCard = document.querySelector(".game-card");

const allBtns = document.querySelectorAll(".btn");
const difficultyBtns = document.querySelectorAll(".difficulty-btn");

const levelDisplay = document.querySelector("#level");
const timerDisplay = document.querySelector("#timer");
const highestScoreDisplay = document.querySelector("#highest-score");

/* SCOREBOARD */

function updateScoreboard() {
  levelDisplay.innerText = level;
  timerDisplay.innerText = timer;
  highestScoreDisplay.innerText = highestScore;
}

/* DIFFICULTY */

difficultyBtns.forEach((btn) => {
  btn.addEventListener("click", function () {
    if (started) return;

    difficultyBtns.forEach((b) => b.classList.remove("active"));
    this.classList.add("active");

    difficulty = this.dataset.mode;
  });
});

/* START GAME */

function startGame() {
  if (started) return;

  getAudioContext();

  started = true;
  level = 0;
  gameSeq = [];
  userSeq = [];
  isPaused = false;

  startBtn.disabled = true;
  startBtn.innerText = "Game Running...";
  difficultyBtns.forEach((btn) => (btn.disabled = true));
  updateScoreboard();
  statusText.innerText = "Get Ready...";
  setTimeout(levelUp, 700);
}

startBtn.addEventListener("click", startGame);

document.addEventListener("keydown", (e) => {
  if (!started && e.target.tagName !== "BUTTON") {
    startGame();
  }
});

/* RESTART */

restartBtn.addEventListener("click", () => {
  stopTimer();
  resetGame();
  startGame();
});

/* LEVEL UP */

function levelUp() {
  if (!started) return;
  stopTimer();
  userSeq = [];
  level++;

  let lastColor = gameSeq[gameSeq.length - 1];
  let availableColors = btns.filter((color) => color !== lastColor);
  let randomColor =
    availableColors[Math.floor(Math.random() * availableColors.length)];
  gameSeq.push(randomColor);

  updateHighScore();
  updateScoreboard();
  checkAchievements();

  statusText.innerText = `Level ${level} - Watch 👀`;
  setTimeout(playSequence, 600);
}

/* PLAY FULL SEQUENCE */

async function playSequence() {
  if (!started) return;
  isPlayingSequence = true;
  disableGameButtons();
  statusText.innerText = `Level ${level} - Watch 👀`;
  await delay(500);

  // Only blink the NEW box of the current level
  const currentColor = gameSeq[gameSeq.length - 1];
  const currentBtn = document.querySelector(`#${currentColor}`);
  gameFlash(currentBtn);
  playSound(currentColor);
  await delay(difficultySettings[difficulty].speed);
  if (!started) return;
  isPlayingSequence = false;

  while (isPaused) {
    await delay(100);
  }

  enableGameButtons();
  statusText.innerText = `Level ${level} - Your Turn! 🎮`;
  startTimer();
}

/* USER BUTTON PRESS */

allBtns.forEach((btn) => {
  btn.addEventListener("click", btnPress);
});

function btnPress() {
  if (!started || isPlayingSequence || isPaused) return;
  const userColor = this.id;
  userFlash(this);
  playSound(userColor);
  userSeq.push(userColor);
  checkAnswer(userSeq.length - 1);
}

/* CHECK ANSWER */

function checkAnswer(index) {
  if (userSeq[index] !== gameSeq[index]) {
    wrongAnswer();
    return;
  }

  if (userSeq.length === gameSeq.length) {
    stopTimer();
    disableGameButtons();
    statusText.innerText = "Correct! Next Level 🚀";
    setTimeout(levelUp, 800);
  }
}

/* WRONG ANSWER */

function wrongAnswer() {
  stopTimer();
  disableGameButtons();
  playErrorSound();
  statusText.innerHTML = `Game Over! Score: <b>${level}</b> 💀`;
  gameCard.classList.add("game-over");
  setTimeout(() => {
    gameCard.classList.remove("game-over");
  }, 500);
  setTimeout(gameOver, 1000);
}

/* TIMER */

function startTimer() {
  timer = difficultySettings[difficulty].time;
  updateScoreboard();
  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    if (isPaused) return;
    timer--;
    updateScoreboard();

    if (timer <= 0) {
      stopTimer();
      timeOut();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

/* TIME OUT */

function timeOut() {
  disableGameButtons();
  playErrorSound();
  statusText.innerHTML = `Time's Up! Score: <b>${level}</b> ⏰`;
  setTimeout(gameOver, 1000);
}

/* PAUSE / RESUME */

pauseBtn.addEventListener("click", () => {
  if (!started) return;
  isPaused = !isPaused;
  if (isPaused) {
    gameCard.classList.add("paused");
    pauseBtn.innerText = "▶ Resume";
    disableGameButtons();
  } else {
    gameCard.classList.remove("paused");
    pauseBtn.innerText = "⏸ Pause";
    if (!isPlayingSequence) {
      enableGameButtons();
    }
  }
});

/* SOUND */

soundBtn.addEventListener("click", () => {
  soundEnabled = !soundEnabled;

  soundBtn.innerText = soundEnabled ? "🔊 Sound ON" : "🔇 Sound OFF";
});

/* =========================================================
   AUDIO SYSTEM
   Reuse one AudioContext instead of creating a new one
   for every sound.
========================================================= */

function getAudioContext() {
  if (!audioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    audioContext = new AudioContext();
  }

  // Browsers can suspend the AudioContext.
  // Resume it when the game needs to play a sound.
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

/* =========================================================
   SIMON SOUND
========================================================= */

function playSound(color) {
  if (!soundEnabled) return;

  const context = getAudioContext();

  if (!context) return;

  const frequencies = {
    red: 261.63,
    yellow: 329.63,
    green: 392,
    blue: 523.25,
  };

  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequencies[color], context.currentTime);

  oscillator.connect(gain);
  gain.connect(context.destination);

  // Consistent volume for every note
  gain.gain.setValueAtTime(0.12, context.currentTime);

  // Smooth fade-out
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);

  oscillator.start(context.currentTime);

  oscillator.stop(context.currentTime + 0.25);
}

/* =========================================================
   ERROR SOUND
========================================================= */

function playErrorSound() {
  if (!soundEnabled) return;

  const context = getAudioContext();
  if (!context) return;

  const now = context.currentTime;

  // First low note
  const oscillator1 = context.createOscillator();
  const gain1 = context.createGain();

  oscillator1.type = "square";
  oscillator1.frequency.setValueAtTime(180, now);
  oscillator1.frequency.exponentialRampToValueAtTime(120, now + 0.16);

  gain1.gain.setValueAtTime(0.08, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  oscillator1.connect(gain1);
  gain1.connect(context.destination);

  oscillator1.start(now);
  oscillator1.stop(now + 0.18);

  // Second lower note
  const oscillator2 = context.createOscillator();
  const gain2 = context.createGain();

  oscillator2.type = "square";
  oscillator2.frequency.setValueAtTime(120, now + 0.15);
  oscillator2.frequency.exponentialRampToValueAtTime(75, now + 0.35);

  gain2.gain.setValueAtTime(0.001, now);
  gain2.gain.setValueAtTime(0.08, now + 0.15);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

  oscillator2.connect(gain2);
  gain2.connect(context.destination);

  oscillator2.start(now + 0.15);
  oscillator2.stop(now + 0.38);
}

/* HIGH SCORE */

function updateHighScore() {
  if (level > highestScore) {
    highestScore = level;
    localStorage.setItem("simonHighScore", highestScore);
  }
  updateScoreboard();
}

/* ACHIEVEMENTS */

function checkAchievements() {
  const achievements = {
    5: "achievement-5",
    10: "achievement-10",
    20: "achievement-20",
  };

  if (achievements[level]) {
    unlockAchievement(achievements[level]);
  }
}

function unlockAchievement(id) {
  const achievement = document.querySelector(`#${id}`);
  if (!achievement) return;

  achievement.classList.remove("locked");
  achievement.classList.add("unlocked");

  let unlocked = JSON.parse(localStorage.getItem("simonAchievements")) || [];

  if (!unlocked.includes(id)) {
    unlocked.push(id);
    localStorage.setItem("simonAchievements", JSON.stringify(unlocked));
  }
}

function loadAchievements() {
  let unlocked = JSON.parse(localStorage.getItem("simonAchievements")) || [];
  unlocked.forEach((id) => {
    const achievement = document.querySelector(`#${id}`);
    if (achievement) {
      achievement.classList.remove("locked");
      achievement.classList.add("unlocked");
    }
  });
}

/* GAME OVER */

function gameOver() {
  stopTimer();
  started = false;
  isPaused = false;
  isPlayingSequence = false;
  disableGameButtons();
  startBtn.disabled = false;
  startBtn.innerText = "▶ Start Game";
  pauseBtn.innerText = "⏸ Pause";
  gameCard.classList.remove("paused");
  difficultyBtns.forEach((btn) => {
    btn.disabled = false;
  });

  updateScoreboard();

  setTimeout(() => {
    statusText.innerHTML = `High Score: <b>${highestScore}</b> 🏆`;
  }, 500);
}

/* BUTTON EFFECTS */

function gameFlash(btn) {
  btn.classList.add("flash");
  setTimeout(() => {
    btn.classList.remove("flash");
  }, 350);
}

function userFlash(btn) {
  btn.classList.add("userflash");
  setTimeout(() => {
    btn.classList.remove("userflash");
  }, 200);
}

/* BUTTON CONTROL */

function disableGameButtons() {
  allBtns.forEach((btn) => {
    btn.disabled = true;
    btn.classList.add("disabled");
  });
}

function enableGameButtons() {
  allBtns.forEach((btn) => {
    btn.disabled = false;
    btn.classList.remove("disabled");
  });
}

/* RESET */

function resetGame() {
  stopTimer();
  started = false;
  level = 0;
  timer = 0;

  gameSeq = [];
  userSeq = [];

  isPaused = false;
  isPlayingSequence = false;

  gameCard.classList.remove("paused");
  pauseBtn.innerText = "⏸ Pause";
  startBtn.disabled = false;
  startBtn.innerText = "▶ Start Game";

  difficultyBtns.forEach((btn) => {
    btn.disabled = false;
  });

  disableGameButtons();
  statusText.innerText = "Press Start to Begin";
  updateScoreboard();
}

/* UTILITY */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* INITIAL STATE */

loadAchievements();
disableGameButtons();
updateScoreboard();
