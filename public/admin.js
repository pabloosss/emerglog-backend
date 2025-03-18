async function fetchUsers() {
    const response = await fetch("/users");
    const users = await response.json();
    document.getElementById("user-list").innerHTML = users.map(user => 
        `<li>${user.name} - ${user.sent ? "✔ Wysłane" : "❌ Niewysłane"}
        <button onclick="deleteUser('${user.name}')">Usuń</button>
        <button onclick="markAsSent('${user.name}')">Oznacz jako wysłane</button>
        </li>`).join("");
}

async function addUser() {
    const name = document.getElementById("new-user-name").value;
    if (!name) return alert("Podaj imię i nazwisko!");

    await fetch("/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
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

window.onload = fetchUsers;
