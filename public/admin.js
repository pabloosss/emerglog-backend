async function fetchUsers() {
    const response = await fetch("/users");
    const users = await response.json();
    document.getElementById("user-list").innerHTML = users.map(user => 
        `<li>${user.name} (${user.email}) - ${user.sent ? "✔ Wysłane" : "❌ Niewysłane"}
        <button onclick="deleteUser('${user.name}')">Usuń</button>
        <button onclick="markAsSent('${user.name}')">Oznacz jako wysłane</button>
        <button onclick="sendPDF('${user.name}', '${user.email}')">Wyślij PDF</button>
        </li>`).join("");
}

async function addUser() {
    const name = document.getElementById("new-user-name").value;
    const email = document.getElementById("new-user-email").value;
    if (!name || !email) return alert("Podaj imię, nazwisko i e-mail!");

    await fetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
    });

    fetchUsers();
}

async function deleteUser(name) {
    await fetch(`/users/${name}`, { method: "DELETE" });
    fetchUsers();
}

async function markAsSent(name) {
    await fetch(`/users/${name}/sent`, { method: "POST" });
    fetchUsers();
}

async function sendPDF(name, email) {
    await fetch("/send-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email })
    });

    fetchUsers();
}

window.onload = fetchUsers;
