
const canvas = document.getElementById("canvas");
canvas.width = window.innerWidth - 60;
canvas.height = 500;

let context = canvas.getContext("2d");
let start_bg_color = "white";
context.fillStyle = start_bg_color;
context.fillRect(0, 0, canvas.width, canvas.height);

let draw_color = "black";
let draw_width = "2";
let is_drawing = false;

let restore_array = [];
let index = -1;

// ============================================
// Drawing Actions Tracking (for persistence)
// ============================================
let drawing_actions = [];
const DRAWING_STORAGE_KEY = "whiteboard_drawings"; // Now stores an array of saves
const MAX_ACTIONS = 500; // Prevent localStorage overflow

// Active tool: 'pen' or 'eraser'
let active_tool = 'pen';

// Helper: get pointer position for mouse or touch events
function getPointerPos(evt) {
  if (evt.touches && evt.touches[0]) {
    return {
      x: evt.touches[0].clientX - canvas.offsetLeft,
      y: evt.touches[0].clientY - canvas.offsetTop
    };
  }
  return {
    x: evt.clientX - canvas.offsetLeft,
    y: evt.clientY - canvas.offsetTop
  };
}

// Initialize pointer event once
function initPointerEvents() {
  canvas.addEventListener("mousedown", start, false);
  canvas.addEventListener("mousemove", draw, false);
  canvas.addEventListener("mouseup", stop, false);
  canvas.addEventListener("mouseout", stop, false);

  canvas.addEventListener("touchstart", start, false);
  canvas.addEventListener("touchmove", draw, false);
  canvas.addEventListener("touchend", stop, false);
}

function change_color(element) {
  draw_color = element.style.background;
}

function pen_tool() {
  active_tool = 'pen';
  canvas.style.cursor = 'crosshair';
  setActiveToolUI('pen');
}

function eraser_tool() {
  active_tool = 'eraser';
  canvas.style.cursor = 'cell';
  setActiveToolUI('eraser');
}

// Visual tool selection helpers
function setActiveToolUI(name) {
  const penEl = document.querySelector('.pen');
  const eraserEl = document.querySelector('.eraser');
  if (penEl) penEl.classList.toggle('active-tool', name === 'pen');
  if (eraserEl) eraserEl.classList.toggle('active-tool', name === 'eraser');
}

function start(event) {
  const pos = getPointerPos(event);
  const x = pos.x;
  const y = pos.y;

  is_drawing = true;
  context.beginPath();
  context.moveTo(x, y);

  // Set composite mode for eraser
  if (active_tool === 'eraser') {
    context.globalCompositeOperation = 'destination-out';
  } else {
    context.globalCompositeOperation = 'source-over';
  }

  // Set stroke style and width for immediate feedback
  context.strokeStyle = draw_color;
  context.lineWidth = draw_width;

  // Log action based on tool
  drawing_actions.push({
    type: active_tool === 'eraser' ? 'erase_start' : 'start',
    x: x,
    y: y,
    color: draw_color,
    width: draw_width,
    timestamp: Date.now()
  });

  event.preventDefault();
}

function draw(event) {
  if (!is_drawing) return event.preventDefault();

  const pos = getPointerPos(event);
  const x = pos.x;
  const y = pos.y;

  // Draw using current composite mode
  context.lineTo(x, y);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = draw_width;
  if (active_tool === 'eraser') {
    // destination-out ignores strokeStyle
    context.globalCompositeOperation = 'destination-out';
  } else {
    context.globalCompositeOperation = 'source-over';
    context.strokeStyle = draw_color;
  }
  context.stroke();

  // Log action according to tool
  drawing_actions.push({
    type: active_tool === 'eraser' ? 'erase_line' : 'lineTo',
    x: x,
    y: y,
    color: draw_color,
    width: draw_width,
    timestamp: Date.now()
  });

  event.preventDefault();
}

function stop(event) {
  if (is_drawing) {
    context.stroke();
    context.closePath();
    is_drawing = false;
    // Reset composite to default
    context.globalCompositeOperation = 'source-over';
  }
  event.preventDefault();

  if (event.type != "mouseout") {
    restore_array.push(context.getImageData(0, 0, canvas.width, canvas.height));
    index += 1;
  }

  console.log(restore_array.length + ' snapshots');
}

function clear_canvas() {
  context.fillStyle = start_bg_color;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillRect(0, 0, canvas.width, canvas.height);

  restore_array = [];
  index = -1;
}

function undo_last() {
  if (index <= 0) {
    clear_canvas();
  } else {
    index -= 1;
    restore_array.pop();
    context.putImageData(restore_array[index], 0, 0);
  }
}

// ============================================
// Save / Load Drawing State (Persistence)
// ============================================

// Replay drawing actions from an action list
function replay_drawing(actions) {
  clear_canvas();
  if (!actions || actions.length === 0) return;

  let current_stroke = [];
  let current_color = "black";
  let current_width = "2";

  actions.forEach(action => {
    if (action.type === "start") {
      // End previous stroke if any
      if (current_stroke.length > 0) {
        context.stroke();
        context.closePath();
        current_stroke = [];
      }
      context.beginPath();
      context.moveTo(action.x, action.y);
      current_color = action.color;
      current_width = action.width;
    } else if (action.type === "lineTo") {
      context.strokeStyle = action.color;
      context.lineWidth = action.width;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineTo(action.x, action.y);
      context.stroke();
    } else if (action.type === 'erase_start') {
      // begin erase stroke
      if (current_stroke.length > 0) {
        context.stroke();
        context.closePath();
        current_stroke = [];
      }
      context.beginPath();
      context.moveTo(action.x, action.y);
      context.globalCompositeOperation = 'destination-out';
      context.lineWidth = action.width;
    } else if (action.type === 'erase_line') {
      context.lineWidth = action.width;
      context.lineTo(action.x, action.y);
      context.stroke();
    } else if (action.type === "rectangle") {
      context.strokeStyle = action.color;
      context.lineWidth = action.width;
      context.strokeRect(action.x1, action.y1, action.x2 - action.x1, action.y2 - action.y1);
    }
  });

  if (current_stroke.length > 0) {
    context.stroke();
    context.closePath();
  }
  // Ensure composite mode reset
  context.globalCompositeOperation = 'source-over';
}

// Save drawing to localStorage as a new file in history
function save_drawing() {
  if (drawing_actions.length === 0) {
    alert("No drawing to save!");
    return;
  }

  // Get existing saves
  const saved_list = get_saved_drawings();

  // Create new save entry
  const filename = prompt("Name your drawing (e.g., 'Sketch #1'):", `Drawing ${saved_list.length + 1}`);
  if (!filename) return;

  const actions_to_save = drawing_actions.slice(-MAX_ACTIONS);
  const new_save = {
    id: Date.now(),
    name: filename,
    actions: actions_to_save,
    savedAt: new Date().toLocaleString(),
    actionCount: actions_to_save.length
  };

  saved_list.push(new_save);
  localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(saved_list));
  
  // Ask user if they want to start a fresh drawing
  const startFresh = confirm(`Drawing saved as "${filename}"!\n\nClick OK to start a fresh drawing, or Cancel to continue drawing.`);
  if (startFresh) {
    clear_canvas();
    drawing_actions = [];
  }
}

// Get all saved drawings from localStorage
function get_saved_drawings() {
  const stored = localStorage.getItem(DRAWING_STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Load drawing from a specific save by ID
function load_drawing_by_id(id) {
  const saved_list = get_saved_drawings();
  const save = saved_list.find(s => s.id === id);
  
  if (!save) {
    alert("Save file not found!");
    return;
  }

  // Reset drawing state and load the saved drawing
  drawing_actions = JSON.parse(JSON.stringify(save.actions)); // Deep copy to prevent reference issues
  replay_drawing(drawing_actions);
  close_saved_files_modal();
  alert(`Loaded: "${save.name}"`);
}

// Delete a saved drawing by ID
function delete_drawing(id) {
  if (!confirm("Are you sure you want to delete this save?")) return;

  let saved_list = get_saved_drawings();
  saved_list = saved_list.filter(s => s.id !== id);
  localStorage.setItem(DRAWING_STORAGE_KEY, JSON.stringify(saved_list));
  
  render_saved_files_list(); // Refresh the modal list
  alert("Save deleted!");
}

// Open the saved files modal
function open_saved_files_modal() {
  const modal = document.getElementById("savedFilesModal");
  if (modal) {
    modal.style.display = "block";
    render_saved_files_list();
  }
}

// Close the saved files modal
function close_saved_files_modal() {
  const modal = document.getElementById("savedFilesModal");
  if (modal) {
    modal.style.display = "none";
  }
}

// Render list of saved drawings in the modal
function render_saved_files_list() {
  const saved_list = get_saved_drawings();
  const list_container = document.getElementById("savedFilesList");
  
  if (!list_container) return;

  if (saved_list.length === 0) {
    list_container.innerHTML = "<p style='text-align:center; color:#999;'>No saved drawings yet.</p>";
    return;
  }

  list_container.innerHTML = saved_list
    .map(save => `
      <div class="save-item">
        <div class="save-info">
          <strong>${save.name}</strong>
          <br/>
          <small>${save.savedAt} (${save.actionCount} actions)</small>
        </div>
        <div class="save-actions">
          <button class="btn btn-sm btn-primary" onclick="load_drawing_by_id(${save.id})">Load</button>
          <button class="btn btn-sm btn-danger" onclick="delete_drawing(${save.id})">Delete</button>
        </div>
      </div>
    `)
    .join("");
}

// Override load button to show modal instead
function load_drawing() {
  open_saved_files_modal();
}

// Auto-load drawing on page load (session recovery - load most recent)
function auto_load_drawing() {
  const saved_list = get_saved_drawings();
  if (saved_list.length > 0) {
    const latest = saved_list[saved_list.length - 1];
    drawing_actions = latest.actions;
    replay_drawing(drawing_actions);
    console.log(`Session recovered: loaded "${latest.name}"`);
  }
}

// Screenshot
const screenshotBtn = document.querySelector(".screenshot");
const takeScreenshot = function () {
  let capture = document.getElementById("capture");
  html2canvas(capture).then(function (canvas) {
    return Canvas2Image.saveAsImage(canvas);
  });
};
screenshotBtn.addEventListener("click", takeScreenshot);

// For dark mode

const chk = document.getElementById("chk");

chk.addEventListener("change", () => {
  document.body.classList.toggle("dark");
});

draw_rect = () => {
  function getMousePos(canvas, evt) {
    var rect = canvas.getBoundingClientRect();
    return {
      x: evt.clientX - rect.left,
      y: evt.clientY - rect.top,
    };
  }

  var locA, locB;
  canvas.addEventListener("mousedown", function (e) {
    e.preventDefault();
    context.beginPath();
    locA = getMousePos(canvas, e);
    stop();
  });

  canvas.addEventListener("mouseup", function (e) {
    context.beginPath();
    e.preventDefault();
    locB = getMousePos(canvas, e);
    context.strokeStyle = draw_color;
    context.strokeRect(locA.x, locA.y, locB.x - locA.x, locB.y - locA.y);
    
    // Log rectangle action
    drawing_actions.push({
      type: "rectangle",
      x1: locA.x,
      y1: locA.y,
      x2: locB.x,
      y2: locB.y,
      color: draw_color,
      width: draw_width,
      timestamp: Date.now()
    });
  });
};

// Initialize: Auto-load on page load for session recovery and set up pointer events
document.addEventListener("DOMContentLoaded", () => {
  initPointerEvents();
  auto_load_drawing();
  // Set default tool UI
  setActiveToolUI(active_tool);
});
