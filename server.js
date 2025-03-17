const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const fs = require("fs");
require("dotenv").config();
const creds = require("./keys.json");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(bodyParser.json());

const SHEET_ID = "10XgqG_OCszYY8wqJlhpiPNgBxuEwFZOJJF2iuXTdqpY";

async function updateSpreadsheet(name, monthYear) {
    try {
        const doc = new GoogleSpreadsheet(SHEET_ID);
        await doc.useServiceAccountAuth(creds);
        await doc.loadInfo();
        
        const sheet = doc.sheetsByIndex[0]; // Zakładamy, że dane są w pierwszym arkuszu
        await sheet.loadHeaderRow();
        
        const rows = await sheet.getRows();
        const monthCol = sheet.headerValues.find(col => col.includes(monthYear));
        
        if (!monthCol) {
            console.error("❌ Nie znaleziono kolumny dla miesiąca:", monthYear);
            return;
        }
        
        for (let row of rows) {
            if (row["Unnamed: 0"].toLowerCase() === name.toLowerCase()) {
                row[monthCol] = "Wysłano";
                await row.save();
                console.log(`✅ Zaktualizowano arkusz: ${name} - ${monthYear}`);
                return;
            }
        }
        
        console.error("❌ Nie znaleziono osoby w arkuszu:", name);
    } catch (error) {
        console.error("❌ Błąd aktualizacji arkusza:", error);
    }
}

app.post("/send-pdf", async (req, res) => {
    const { name, email, tableData, monthYear } = req.body;
    if (!name || !email || !tableData || !Array.isArray(tableData) || !monthYear) {
        return res.status(400).json({ message: "❌ Brak wymaganych danych!" });
    }

    console.log("📩 Próba wysyłki e-maila na adres:", email);
    const filePath = `./${name.replace(/\s+/g, "_")}_schedule.pdf`;
    
    fs.writeFileSync(filePath, "Dane PDF (symulacja)");
    
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
        subject: `Twój harmonogram godzin - ${name}`,
        text: "W załączniku znajdziesz swój harmonogram godzin.",
        attachments: [{ filename: `${name}_schedule.pdf`, path: filePath }],
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log("✅ Email wysłany do:", email);
        await updateSpreadsheet(name, monthYear);
        res.json({ message: "✅ PDF wysłany i arkusz zaktualizowany!" });
        
        setTimeout(() => fs.unlinkSync(filePath), 5000);
    } catch (error) {
        console.error("❌ Błąd wysyłania e-maila:", error);
        res.status(500).json({ message: "❌ Błąd wysyłania e-maila", error });
    }
});

app.listen(PORT, () => console.log(`✅ Serwer działa na porcie ${PORT}`));
