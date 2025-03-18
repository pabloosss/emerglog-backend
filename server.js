// server.js - Główny backend Express
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Udostępnianie plików statycznych

const DATA_FILE = "database.json";

// 📌 Wczytywanie bazy danych
const loadData = () => {
    if (!fs.existsSync(DATA_FILE)) return [];
    const rawData = fs.readFileSync(DATA_FILE);
    return JSON.parse(rawData);
};

// 📌 Zapisywanie bazy danych
const saveData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// 📌 Pobieranie użytkowników
app.get("/users", (req, res) => {
    const users = loadData();
    res.json(users);
});

// 📌 Dodawanie nowego użytkownika
app.post("/users", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Brak imienia i nazwiska" });

    const users = loadData();
    users.push({ name, sent: false });
    saveData(users);
    res.json({ message: "Dodano użytkownika" });
});

// 📌 Usuwanie użytkownika
app.delete("/users/:name", (req, res) => {
    const { name } = req.params;
    let users = loadData();
    users = users.filter(user => user.name !== name);
    saveData(users);
    res.json({ message: "Usunięto użytkownika" });
});

// 📌 Oznaczanie wysłania
app.post("/users/:name/sent", (req, res) => {
    const { name } = req.params;
    const users = loadData();
    const user = users.find(user => user.name === name);
    if (user) {
        user.sent = true;
        saveData(users);
        res.json({ message: "Oznaczono jako wysłane" });
    } else {
        res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }
});

// 📌 Strona logowania do panelu admina
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// 📌 Strona główna
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
