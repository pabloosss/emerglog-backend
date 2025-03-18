const express = require("express");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("public")); // Serwowanie plików statycznych (frontend)

const DATA_FILE = "database.json"; // Plik przechowujący bazę użytkowników

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

// 📌 Pobieranie listy użytkowników
app.get("/users", (req, res) => {
    const users = loadData();
    res.json(users);
});

// 📌 Dodawanie nowego użytkownika
app.post("/users", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Brak imienia i nazwiska" });

    let users = loadData();
    if (users.some(user => user.name === name)) {
        return res.status(400).json({ message: "Taki użytkownik już istnieje!" });
    }

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

// 📌 Oznaczanie użytkownika jako "wysłane"
app.post("/users/:name/sent", (req, res) => {
    const { name } = req.params;
    let users = loadData();
    const user = users.find(user => user.name === name);

    if (user) {
        user.sent = true;
        saveData(users);
        res.json({ message: "Oznaczono jako wysłane" });
    } else {
        res.status(404).json({ message: "Użytkownik nie znaleziony" });
    }
});

// 📌 Resetowanie statusów użytkowników (tylko dla admina)
app.post("/reset-users", (req, res) => {
    const { username, password } = req.body;
    if (username !== "admin" || password !== "admin") {
        return res.status(401).json({ message: "Nieprawidłowe dane logowania!" });
    }

    let users = loadData();
    users.forEach(user => user.sent = false);
    saveData(users);

    res.json({ message: "Zresetowano status wszystkich użytkowników!" });
});

// 📌 Strona logowania do panelu admina
app.get("/admin", (req, res) => {
    res.sendFile(__dirname + "/public/admin.html");
});

// 📌 Strona główna
app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

// 📌 Start serwera
app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
