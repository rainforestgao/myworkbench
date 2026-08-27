/* 高钰琳课表工作台 — 交互逻辑 */
(function () {
  "use strict";

  var LS_SCHEDULE = "gyl_workbench_schedule_v1";
  var LS_TODOS = "gyl_workbench_todos_v1";

  /* ---------- 数据 ---------- */
  function loadSchedule() {
    try {
      var raw = localStorage.getItem(LS_SCHEDULE);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.meta && Array.isArray(d.weeks) && d.weeks.length) return d;
      }
    } catch (e) { /* 忽略损坏数据 */ }
    return window.SCHEDULE_DATA;
  }

  var DATA = loadSchedule();
  var META = DATA.meta;
  var FIRST_MONDAY = new Date(META.firstMonday + "T00:00:00");

  function todayStr(d) {
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return m + "-" + day;
  }

  /* ---------- 工具 ---------- */
  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ---------- 顶部问候 ---------- */
  function renderGreet() {
    var now = new Date();
    var h = now.getHours();
    var g = "晚上好";
    if (h >= 5 && h < 11) g = "早上好";
    else if (h >= 11 && h < 14) g = "中午好";
    else if (h >= 14 && h < 18) g = "下午好";
    var wd = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];
    $("greetText").textContent = g + "，高钰琳 🌸";
    $("dateLine").innerHTML = "今天是 <b>" + (now.getMonth() + 1) + " 月 " + now.getDate() + " 日 · 星期" + wd + "</b> · " + META.semester + " 学期";
  }

  /* ---------- 课表渲染 ---------- */
  var currentWeek = 1;
  var todayHighlight = ""; // 形如 "MM-DD"

  function weekMonday(weekIdx) {
    return new Date(FIRST_MONDAY.getTime() + (weekIdx - 1) * 7 * 86400000);
  }

  function autoWeek() {
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    var diff = Math.floor((now - FIRST_MONDAY) / 86400000);
    var w = Math.floor(diff / 7) + 1;
    if (w < 1) w = 1;
    if (w > META.weekCount) w = META.weekCount;
    return w;
  }

  function currentDayColumn() {
    var today = todayStr(new Date());
    var mon = weekMonday(currentWeek);
    for (var i = 0; i < 7; i++) {
      var d = new Date(mon.getTime() + i * 86400000);
      if (todayStr(d) === today) return i;
    }
    return -1;
  }

  function renderWeekSelect() {
    var sel = $("weekSelect");
    sel.innerHTML = "";
    for (var i = 1; i <= META.weekCount; i++) {
      var opt = document.createElement("option");
      opt.value = i;
      opt.textContent = "第 " + i + " 周";
      sel.appendChild(opt);
    }
    sel.value = currentWeek;
  }

  function renderSchedule() {
    var wk = DATA.weeks[currentWeek - 1];
    var sel = $("weekSelect");
    if (sel) sel.value = currentWeek;
    $("weekLabel").textContent = "第 " + currentWeek + " 周";
    $("prevWeek").disabled = currentWeek <= 1;
    $("nextWeek").disabled = currentWeek >= META.weekCount;

    // 周日期范围
    var mon = weekMonday(currentWeek);
    var sun = new Date(mon.getTime() + 6 * 86400000);
    $("weekRange").textContent = (mon.getMonth() + 1) + "." + mon.getDate() + " – " + (sun.getMonth() + 1) + "." + sun.getDate();

    todayHighlight = currentDayColumn();

    var table = $("scheduleTable");
    var holiday = $("holidayNote");

    // 第 21/22 周（无日期、无课）空态
    var hasAny = false;
    for (var b = 0; b < wk.cells.length; b++) {
      for (var d = 0; d < 7; d++) {
        if (wk.cells[b][d].t) { hasAny = true; break; }
      }
      if (hasAny) break;
    }
    if (!hasAny) {
      table.innerHTML = "";
      holiday.hidden = false;
      holiday.textContent = "第 " + currentWeek + " 周 · 假期中，没有课程安排 ✨ 好好休息～";
      return;
    }
    holiday.hidden = true;

    var html = '<tr>';
    html += '<th class="day-head col-time">周次 / 日期</th>';
    for (var d = 0; d < 7; d++) {
      var isToday = (d === todayHighlight);
      html += '<th class="day-head col-day' + (isToday ? " today" : "") + '">' +
        esc(META.weekdays[d]) + (isToday ? "<br><small>今天</small>" : "") + "</th>";
    }
    html += "</tr>";

    // 日期行
    html += "<tr>";
    html += '<td class="time-cell"></td>';
    for (var d = 0; d < 7; d++) {
      var dd = wk.dates && wk.dates[d] ? wk.dates[d] : "";
      html += '<td class="time-cell' + (d === todayHighlight ? " today" : "") + '">' + esc(dd) + "</td>";
    }
    html += "</tr>";

    // 大节行
    var skipCol = {};
    for (var b = 0; b < 6; b++) {
      html += "<tr>";
      html += '<td class="time-cell">' + esc(META.bigNames[b]) + "</td>";
      for (var d = 0; d < 7; d++) {
        if (skipCol[d] === b) { skipCol[d] = -1; continue; }
        var cell = wk.cells[b][d];
        var cls = "course-cell";
        var rowspan = "";
        if (cell.s === 2) { rowspan = ' rowspan="2"'; skipCol[d] = b + 1; }
        if (cell.t) {
          if (cell.c === "pink") cls += " pink";
          else if (cell.c === "green") cls += " green";
          if (d === todayHighlight) cls += " today";
          // 第一行课程名加粗，其余行弱化
          var lines = esc(cell.t).split("\n");
          var inner = '<div class="c-name">' + (lines[0] || "") + "</div>";
          if (lines.length > 1) inner += '<div class="c-meta">' + lines.slice(1).join("<br>") + "</div>";
          html += '<td class="' + cls + '"' + rowspan + ">" + inner + "</td>";
        } else {
          html += '<td class="course-cell empty"' + rowspan + "></td>";
        }
      }
      html += "</tr>";
    }
    table.innerHTML = html;
  }

  function setWeek(w) {
    if (w < 1) w = 1;
    if (w > META.weekCount) w = META.weekCount;
    currentWeek = w;
    renderWeekSelect();
    renderSchedule();
  }

  /* ---------- 每日一句 ---------- */
  var LS_POEM_FONT = "gyl_workbench_poemfont_v1";
  var poemFont = "kaiti";
  try { poemFont = localStorage.getItem(LS_POEM_FONT) || "kaiti"; } catch (e) { /* 忽略 */ }

  function renderPoem() {
    var poems = window.POEMS;
    if (!poems || !poems.length) { $("poemCard").style.display = "none"; return; }
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var dayOfYear = Math.floor((now - start) / 86400000);
    var poem = poems[dayOfYear % poems.length];
    $("poemLine").textContent = poem.p;
    $("poemSrc").textContent = "—— " + poem.s;
    applyPoemFont();
  }
  function applyPoemFont() {
    var line = $("poemLine");
    if (poemFont === "xing") line.classList.add("xing");
    else line.classList.remove("xing");
    document.querySelectorAll("#poemSwitch .pf-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-font") === poemFont);
    });
  }
  function bindPoemSwitch() {
    document.querySelectorAll("#poemSwitch .pf-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        poemFont = this.getAttribute("data-font");
        try { localStorage.setItem(LS_POEM_FONT, poemFont); } catch (e) { /* 忽略 */ }
        applyPoemFont();
      });
    });
  }

  /* ---------- 待办事项 ---------- */
  var todos = [];
  function loadTodos() {
    try {
      var raw = localStorage.getItem(LS_TODOS);
      todos = raw ? JSON.parse(raw) : [];
    } catch (e) { todos = []; }
    if (!Array.isArray(todos)) todos = [];
  }
  function saveTodos() {
    try { localStorage.setItem(LS_TODOS, JSON.stringify(todos)); } catch (e) { /* 忽略 */ }
  }
  function renderTodos() {
    var list = $("todoList");
    var empty = $("todoEmpty");
    var remain = todos.filter(function (t) { return !t.done; }).length;
    list.innerHTML = "";
    todos.forEach(function (t, i) {
      var li = document.createElement("li");
      li.className = "todo-item" + (t.done ? " done" : "");
      var cb = document.createElement("span");
      cb.className = "todo-check";
      cb.setAttribute("role", "checkbox");
      cb.setAttribute("aria-checked", t.done ? "true" : "false");
      cb.setAttribute("tabindex", "0");
      cb.addEventListener("click", function () { toggleTodo(i); });
      cb.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleTodo(i); }
      });
      var txt = document.createElement("span");
      txt.className = "todo-text";
      txt.textContent = t.text;
      var del = document.createElement("button");
      del.className = "todo-del";
      del.textContent = "✕";
      del.setAttribute("aria-label", "删除待办");
      del.addEventListener("click", function () { removeTodo(i); });
      li.appendChild(cb); li.appendChild(txt); li.appendChild(del);
      list.appendChild(li);
    });
    empty.style.display = todos.length ? "none" : "block";
    $("todoCount").textContent = remain;
  }
  function addTodo(text) {
    text = text.trim();
    if (!text) return;
    todos.unshift({ text: text, done: false, at: Date.now() });
    saveTodos();
    renderTodos();
  }
  function toggleTodo(i) {
    todos[i].done = !todos[i].done;
    saveTodos();
    renderTodos();
  }
  function removeTodo(i) {
    todos.splice(i, 1);
    saveTodos();
    renderTodos();
  }
  function clearDone() {
    todos = todos.filter(function (t) { return !t.done; });
    saveTodos();
    renderTodos();
  }

  /* ---------- 数据导入导出 ---------- */
  function download(filename, text) {
    var a = document.createElement("a");
    a.href = "data:text/plain;charset=utf-8," + encodeURIComponent(text);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  function showMsg(cls, text) {
    var m = $("dataMsg");
    m.className = "msg " + cls;
    m.textContent = text;
  }
  function validateSchedule(obj) {
    if (!obj || typeof obj !== "object") return "数据格式不正确：需要是一个对象";
    if (!obj.meta || typeof obj.meta !== "object") return "缺少 meta 字段";
    if (!Array.isArray(obj.weeks) || !obj.weeks.length) return "缺少 weeks 数组";
    for (var i = 0; i < obj.weeks.length; i++) {
      var wk = obj.weeks[i];
      if (!wk || !Array.isArray(wk.cells) || wk.cells.length !== 6) return "第 " + (i + 1) + " 周数据格式不正确（需要 6 个大节）";
      for (var b = 0; b < 6; b++) {
        if (!Array.isArray(wk.cells[b]) || wk.cells[b].length !== 7) return "第 " + (i + 1) + " 周第 " + (b + 1) + " 大节需要 7 个格子";
      }
    }
    return null;
  }

  /* ---------- 弹窗 ---------- */
  function openModal(id) { $(id).classList.add("show"); }
  function closeModal(id) { $(id).classList.remove("show"); }

  /* ---------- 绑定事件 ---------- */
  function bind() {
    $("prevWeek").addEventListener("click", function () { setWeek(currentWeek - 1); });
    $("nextWeek").addEventListener("click", function () { setWeek(currentWeek + 1); });
    $("thisWeek").addEventListener("click", function () { setWeek(autoWeek()); });
    $("weekSelect").addEventListener("change", function () { setWeek(parseInt(this.value, 10) || 1); });

    $("todoAdd").addEventListener("click", function () {
      addTodo($("todoInput").value);
      $("todoInput").value = "";
      $("todoInput").focus();
    });
    $("todoInput").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        addTodo(this.value);
        this.value = "";
      }
    });
    $("todoClear").addEventListener("click", clearDone);

    $("openDataModal").addEventListener("click", function () { openModal("dataModal"); });
    $("openDataModalBtn").addEventListener("click", function () { openModal("dataModal"); });
    $("closeDataModal").addEventListener("click", function () { closeModal("dataModal"); });
    $("openAboutModal").addEventListener("click", function () { openModal("aboutModal"); });
    $("closeAboutModal").addEventListener("click", function () { closeModal("aboutModal"); });

    $("exportData").addEventListener("click", function () {
      var cur = loadSchedule();
      var out = JSON.stringify(cur, null, 2);
      $("dataTextarea").value = out;
      showMsg("ok", "已导出到文本框（也可直接下载文件）");
      download("gyl-schedule-data.json", out);
    });
    $("importData").addEventListener("click", function () {
      var text = $("dataTextarea").value.trim();
      if (!text) { showMsg("err", "请先粘贴课表 JSON 数据"); return; }
      var obj;
      try { obj = JSON.parse(text); } catch (e) { showMsg("err", "JSON 解析失败：" + e.message); return; }
      var err = validateSchedule(obj);
      if (err) { showMsg("err", err); return; }
      try {
        localStorage.setItem(LS_SCHEDULE, JSON.stringify(obj));
      } catch (e) { showMsg("err", "保存失败（存储空间不足？）"); return; }
      DATA = obj;
      META = obj.meta;
      FIRST_MONDAY = new Date(META.firstMonday + "T00:00:00");
      currentWeek = autoWeek();
      $("semInfo").textContent = META.semester + " 学期";
      renderGreet();
      renderWeekSelect();
      renderSchedule();
      closeModal("dataModal");
      showMsg("ok", "");
    });
    $("resetData").addEventListener("click", function () {
      localStorage.removeItem(LS_SCHEDULE);
      DATA = window.SCHEDULE_DATA;
      META = DATA.meta;
      FIRST_MONDAY = new Date(META.firstMonday + "T00:00:00");
      currentWeek = autoWeek();
      $("semInfo").textContent = META.semester + " 学期";
      renderGreet();
      renderWeekSelect();
      renderSchedule();
      $("dataTextarea").value = "";
      showMsg("ok", "已恢复为默认课表");
    });

    // 点遮罩关闭
    document.querySelectorAll(".modal-mask").forEach(function (mask) {
      mask.addEventListener("click", function (e) {
        if (e.target === mask) mask.classList.remove("show");
      });
    });
    // Esc 关闭
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        closeModal("dataModal");
        closeModal("aboutModal");
      }
    });
  }

  /* ---------- 启动 ---------- */
  function init() {
    $("semInfo").textContent = META.semester + " 学期";
    renderGreet();
    renderPoem();
    bindPoemSwitch();
    loadTodos();
    currentWeek = autoWeek();
    renderWeekSelect();
    renderSchedule();
    renderTodos();
    bind();
  }
  init();
})();
