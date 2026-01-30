// ============================================
// Notes App with localStorage persistence
// ============================================

let notes = [];
const STORAGE_KEY = "whiteboard_notes";

// DOM Elements
const addBtn = document.getElementById("addBtn");
const addTxt = document.getElementById("addTxt");
const searchTxt = document.getElementById("searchTxt");
const notesContainer = document.getElementById("notes");

// Load notes from localStorage on page load
function loadNotes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  notes = stored ? JSON.parse(stored) : [];
  renderNotes();
}

// Save notes to localStorage
function saveNotes() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

// Add a new note
function addNote() {
  const text = addTxt.value.trim();
  if (!text) {
    alert("Please enter a note!");
    return;
  }

  const note = {
    id: Date.now(),
    text: text,
    createdAt: new Date().toLocaleString()
  };

  notes.unshift(note);
  saveNotes();
  addTxt.value = "";
  renderNotes();
}

// Delete a note
function deleteNote(id) {
  if (confirm("Are you sure you want to delete this note?")) {
    notes = notes.filter(note => note.id !== id);
    saveNotes();
    renderNotes();
  }
}

// Edit a note
function editNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;

  const newText = prompt("Edit your note:", note.text);
  if (newText !== null && newText.trim() !== "") {
    note.text = newText.trim();
    note.createdAt = new Date().toLocaleString(); // Update timestamp
    saveNotes();
    renderNotes();
  }
}

// Search notes
function searchNotes() {
  const query = searchTxt.value.toLowerCase();
  const filtered = notes.filter(note =>
    note.text.toLowerCase().includes(query)
  );
  renderNotes(filtered);
}

// Render notes to the DOM
function renderNotes(notesToRender = notes) {
  notesContainer.innerHTML = "";

  if (notesToRender.length === 0) {
    notesContainer.innerHTML = "<p style='text-align:center; color:#999;'>No notes yet. Add one above!</p>";
    return;
  }

  notesToRender.forEach(note => {
    const noteCard = document.createElement("div");
    noteCard.className = "card col-md-4 mx-2 my-2";
    noteCard.style.width = "18rem";
    noteCard.innerHTML = `
      <div class="card-body">
        <h5 class="card-title">Note</h5>
        <p class="card-text">${escapeHtml(note.text)}</p>
        <small class="text-muted">${note.createdAt}</small>
        <div style="margin-top: 10px;">
          <button class="btn btn-sm btn-warning mr-2" onclick="editNote(${note.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteNote(${note.id})">Delete</button>
        </div>
      </div>
    `;
    notesContainer.appendChild(noteCard);
  });
}

// Helper: Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Event Listeners
if (addBtn) {
  addBtn.addEventListener("click", addNote);
}

if (addTxt) {
  addTxt.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addNote();
    }
  });
}

if (searchTxt) {
  searchTxt.addEventListener("input", searchNotes);
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", loadNotes);
