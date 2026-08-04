const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOAD_DIR = path.join(__dirname, "tmp", "uploads");
const OUTPUT_DIR = path.join(__dirname, "tmp", "outputs");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 500 * 1024 * 1024 } });

const tasks = {};

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "VMP API rodando" });
});

app.post("/enviar-clipe", upload.single("video"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Nenhum arquivo enviado" });
  }
  res.json({
    fileId: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size
  });
});

app.post("/criar-tarefa", (req, res) => {
  const { combinations } = req.body;
  if (!combinations || !Array.isArray(combinations) || combinations.length === 0) {
    return res.status(400).json({ error: "Combinações inválidas" });
  }

  const taskId = uuidv4();
  tasks[taskId] = {
    id: taskId,
    status: "pending",
    total: combinations.length,
    completed: 0,
    results: [],
    createdAt: new Date().toISOString()
  };

  processCombinations(taskId, combinations);

  res.json({ taskId, total: combinations.length });
});

app.get("/tarefa/:id", (req, res) => {
  const task = tasks[req.params.id];
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
  res.json(task);
});

app.get("/tarefa/:id/resultados", (req, res) => {
  const task = tasks[req.params.id];
  if (!task) return res.status(404).json({ error: "Tarefa não encontrada" });
  if (task.status !== "done") return res.status(202).json({ status: task.status, message: "Ainda processando" });
  res.json({ results: task.results });
});

app.get("/download/:filename", (req, res) => {
  const filePath = path.join(OUTPUT_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Arquivo não encontrado" });
  res.download(filePath);
});

async function processCombinations(taskId, combinations) {
  tasks[taskId].status = "processing";

  for (let i = 0; i < combinations.length; i++) {
    const combo = combinations[i];
    try {
      const outputFile = await combineVideos(combo);
      tasks[taskId].results.push({ index: i, file: outputFile, status: "ok" });
    } catch (err) {
      tasks[taskId].results.push({ index: i, error: err.message, status: "error" });
    }
    tasks[taskId].completed = i + 1;
  }

  tasks[taskId].status = "done";
  setTimeout(() => cleanupTask(taskId), 60 * 60 * 1000);
}

function combineVideos({ hook, body, cta }) {
  return new Promise((resolve, reject) => {
    const outputFilename = `${uuidv4()}.mp4`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    const hookPath = path.join(UPLOAD_DIR, hook);
    const bodyPath = path.join(UPLOAD_DIR, body);
    const ctaPath = path.join(UPLOAD_DIR, cta);

    for (const p of [hookPath, bodyPath, ctaPath]) {
      if (!fs.existsSync(p)) return reject(new Error(`Arquivo não encontrado: ${p}`));
    }

    ffmpeg()
      .input(hookPath)
      .input(bodyPath)
      .input(ctaPath)
      .on("error", reject)
      .on("end", () => resolve(outputFilename))
      .mergeToFile(outputPath, path.join(__dirname, "tmp"));
  });
}

function cleanupTask(taskId) {
  const task = tasks[taskId];
  if (!task) return;
  task.results.forEach(r => {
    if (r.file) {
      const filePath = path.join(OUTPUT_DIR, r.file);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  });
  delete tasks[taskId];
}

app.listen(PORT, () => {
  console.log(`VMP API rodando na porta ${PORT}`);
});
