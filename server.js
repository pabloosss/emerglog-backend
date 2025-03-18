const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
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
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ message: "Brak imienia, nazwiska lub e-maila" });

    const users = loadData();
    const exists = users.some(user => user.name === name);
    if (exists) return res.status(400).json({ message: "Użytkownik już istnieje" });

    users.push({ name, email, sent: false });
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

// 📌 Wysyłanie PDF i e-maila
app.post("/send-pdf", async (req, res) => {
    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ message: "Brak wymaganych danych" });
    }

    const users = loadData();
    const user = users.find(u => u.name.toLowerCase().trim() === name.toLowerCase().trim());
    if (!user) {
        return res.status(404).json({ message: `❌ Użytkownik "${name}" nie znaleziony w bazie danych!` });
    }

    // 📌 Tworzenie pliku PDF
    const doc = new PDFDocument();
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(20).text(`Harmonogram dla: ${name}`, { align: "center" });
    doc.moveDown().fontSize(12).text(`Data wysyłki: ${new Date().toLocaleDateString()}`);
    doc.end();

    writeStream.on("finish", async () => {
        let transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        });

        let mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: `Twój harmonogram - ${name}`,
            text: "W załączniku znajdziesz swój harmonogram.",
            attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }],
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Email wysłany do: ${email}`);
            user.sent = true;
            saveData(users);
            res.json({ message: "✅ PDF wysłany!" });

            // 📌 Usunięcie pliku po wysłaniu
            setTimeout(() => fs.unlinkSync(filePath), 5000);
        } catch (error) {
            console.error("❌ Błąd wysyłania e-maila:", error);
            res.status(500).json({ message: "❌ Błąd wysyłania e-maila", error });
        }
    });
});

// 📌 Strona admina
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// 📌 Strona główna
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
