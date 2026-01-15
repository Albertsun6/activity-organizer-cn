const STORAGE_KEY = "activity_tool_v1";

const state = loadState();

const refs = {
  eventTitle: document.getElementById("eventTitle"),
  eventDate: document.getElementById("eventDate"),
  eventLocation: document.getElementById("eventLocation"),
  eventCapacity: document.getElementById("eventCapacity"),
  eventDesc: document.getElementById("eventDesc"),
  statCapacity: document.getElementById("statCapacity"),
  statConfirmed: document.getElementById("statConfirmed"),
  statWait: document.getElementById("statWait"),
  statCheckin: document.getElementById("statCheckin"),
  confirmedTable: document.getElementById("confirmedTable"),
  waitlistTable: document.getElementById("waitlistTable"),
  toast: document.getElementById("toast"),
  qrLayer: document.getElementById("qrLayer"),
  qrContainer: document.getElementById("qrContainer"),
  qrTitle: document.getElementById("qrTitle"),
  qrLink: document.getElementById("qrLink"),
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        event: {
          title: "",
          datetime: "",
          location: "",
          capacity: 50,
          desc: "",
        },
        attendees: [],
      };
    }
    const parsed = JSON.parse(raw);
    parsed.attendees ||= [];
    parsed.event ||= {};
    return parsed;
  } catch (err) {
    console.warn("读取存储失败，已重置", err);
    return {
      event: { title: "", datetime: "", location: "", capacity: 50, desc: "" },
      attendees: [],
    };
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function init() {
  bindEvents();
  renderEventForm();
  renderAll();
  handleCheckinParam();
}

function bindEvents() {
  document.getElementById("saveEvent").addEventListener("click", saveEvent);
  document.getElementById("eventForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveEvent();
  });

  document.getElementById("regForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addAttendeeFromForm();
  });

  document.getElementById("downloadIcs").addEventListener("click", downloadIcs);
  document.getElementById("copyShare").addEventListener("click", copyShare);
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.getElementById("exportJson").addEventListener("click", exportJson);
  document.getElementById("importJson").addEventListener("change", importJson);
  document.getElementById("resetData").addEventListener("click", resetData);
  document.getElementById("fillFromWaitlist").addEventListener("click", fillFromWaitlist);
  document.getElementById("closeQr").addEventListener("click", hideQr);
  refs.qrLayer.addEventListener("click", (e) => {
    if (e.target === refs.qrLayer) hideQr();
  });
}

function saveEvent() {
  state.event.title = refs.eventTitle.value.trim();
  state.event.datetime = refs.eventDate.value;
  state.event.location = refs.eventLocation.value.trim();
  state.event.capacity = Math.max(1, Number(refs.eventCapacity.value || 1));
  state.event.desc = refs.eventDesc.value.trim();
  persist();
  renderAll();
  toast("活动信息已保存");
  fillFromWaitlist();
}

function renderEventForm() {
  refs.eventTitle.value = state.event.title || "";
  refs.eventDate.value = state.event.datetime || "";
  refs.eventLocation.value = state.event.location || "";
  refs.eventCapacity.value = state.event.capacity || 50;
  refs.eventDesc.value = state.event.desc || "";
}

function addAttendeeFromForm() {
  const name = document.getElementById("name").value.trim();
  if (!name) {
    toast("姓名不能为空");
    return;
  }
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const note = document.getElementById("note").value.trim();

  const attendee = {
    id: crypto.randomUUID(),
    name,
    email,
    phone,
    note,
    status: computeStatus(),
    createdAt: new Date().toISOString(),
    checkin: { done: false, time: null },
  };

  state.attendees.push(attendee);
  persist();
  renderAll();
  document.getElementById("regForm").reset();
  toast(attendee.status === "confirmed" ? "报名成功" : "超出名额，已加入候补");
}

function computeStatus() {
  const capacity = Number(state.event.capacity || 0);
  const confirmed = state.attendees.filter((a) => a.status === "confirmed").length;
  return confirmed < capacity ? "confirmed" : "waitlist";
}

function renderAll() {
  const counts = getCounts();
  refs.statCapacity.textContent = `名额 ${state.event.capacity || 0}`;
  refs.statConfirmed.textContent = `已报 ${counts.confirmed}`;
  refs.statWait.textContent = `候补 ${counts.waitlist}`;
  refs.statCheckin.textContent = `签到 ${counts.checkin}`;

  renderTable("confirmed");
  renderTable("waitlist");
}

function getCounts() {
  return state.attendees.reduce(
    (acc, cur) => {
      if (cur.status === "confirmed") acc.confirmed += 1;
      if (cur.status === "waitlist") acc.waitlist += 1;
      if (cur.checkin?.done) acc.checkin += 1;
      return acc;
    },
    { confirmed: 0, waitlist: 0, checkin: 0 }
  );
}

function renderTable(type) {
  const container = type === "confirmed" ? refs.confirmedTable : refs.waitlistTable;
  const rows = state.attendees.filter((a) => a.status === type);
  if (!rows.length) {
    container.innerHTML = `<div class="muted" style="padding:12px;">暂无数据</div>`;
    return;
  }

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>姓名</th>
      <th>联系方式</th>
      <th>状态</th>
      <th>备注</th>
      <th>操作</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  rows.forEach((a) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(a.name)}</td>
      <td>
        <div>${a.phone ? escapeHtml(a.phone) : "-"}</div>
        <div class="muted">${a.email ? escapeHtml(a.email) : ""}</div>
      </td>
      <td>
        ${renderStatusBadge(a)}
        ${a.checkin?.done ? `<div class="muted" style="font-size:12px;">${formatTime(a.checkin.time)}</div>` : ""}
      </td>
      <td>${a.note ? escapeHtml(a.note) : "-"}</td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          ${type === "confirmed" ? `<button class="small ghost" data-action="checkin" data-id="${a.id}">${a.checkin?.done ? "已签到" : "签到"}</button>` : ""}
          ${type === "waitlist" ? `<button class="small ghost" data-action="promote" data-id="${a.id}">补位</button>` : ""}
          <button class="small ghost" data-action="qr" data-id="${a.id}">二维码</button>
          <button class="small danger ghost" data-action="cancel" data-id="${a.id}">取消</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = "";
  container.appendChild(table);

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === "checkin") toggleCheckin(id);
    if (action === "promote") promote(id);
    if (action === "cancel") cancelAttendee(id);
    if (action === "qr") showQrFor(id);
  });
}

function renderStatusBadge(a) {
  if (a.checkin?.done) {
    return `<span class="badge green">已签到</span>`;
  }
  return a.status === "confirmed"
    ? `<span class="badge gray">待签到</span>`
    : `<span class="badge orange">候补</span>`;
}

function toggleCheckin(id) {
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee) return;
  if (attendee.status !== "confirmed") {
    toast("仍在候补，无法签到");
    return;
  }
  attendee.checkin = {
    done: true,
    time: attendee.checkin?.time || new Date().toISOString(),
  };
  persist();
  renderAll();
  toast(`已签到：${attendee.name}`);
}

function promote(id) {
  const capacity = Number(state.event.capacity || 0);
  const confirmed = state.attendees.filter((a) => a.status === "confirmed").length;
  if (confirmed >= capacity) {
    toast("暂无空位");
    return;
  }
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee || attendee.status !== "waitlist") return;
  attendee.status = "confirmed";
  persist();
  renderAll();
  toast(`已补位：${attendee.name}`);
}

function cancelAttendee(id) {
  const idx = state.attendees.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const name = state.attendees[idx].name;
  state.attendees.splice(idx, 1);
  persist();
  fillFromWaitlist();
  renderAll();
  toast(`已取消：${name}`);
}

function fillFromWaitlist() {
  const capacity = Number(state.event.capacity || 0);
  let confirmed = state.attendees.filter((a) => a.status === "confirmed").length;
  const waitlist = state.attendees.filter((a) => a.status === "waitlist");
  if (!waitlist.length) return;
  waitlist.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  for (const w of waitlist) {
    if (confirmed >= capacity) break;
    w.status = "confirmed";
    confirmed += 1;
  }
  persist();
  renderAll();
}

function exportCsv() {
  const headers = ["姓名", "邮箱", "手机号", "备注", "状态", "签到", "时间"];
  const rows = state.attendees.map((a) => [
    wrapCsv(a.name),
    wrapCsv(a.email || ""),
    wrapCsv(a.phone || ""),
    wrapCsv(a.note || ""),
    wrapCsv(a.status === "confirmed" ? "已报名" : "候补"),
    wrapCsv(a.checkin?.done ? "已签到" : "未签到"),
    wrapCsv(a.checkin?.time ? formatTime(a.checkin.time) : ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadBlob(csv, "text/csv;charset=utf-8", "活动名单.csv");
}

function exportJson() {
  downloadBlob(JSON.stringify(state, null, 2), "application/json", "activity-data.json");
}

function importJson(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== "object") throw new Error("格式不对");
      state.event = data.event || state.event;
      state.attendees = Array.isArray(data.attendees) ? data.attendees : [];
      persist();
      renderEventForm();
      renderAll();
      toast("导入成功");
    } catch (err) {
      toast("导入失败，请检查文件格式");
      console.error(err);
    } finally {
      e.target.value = "";
    }
  };
  reader.readAsText(file);
}

function resetData() {
  if (!confirm("确认清空所有数据？此操作不可恢复。")) return;
  state.event = { title: "", datetime: "", location: "", capacity: 50, desc: "" };
  state.attendees = [];
  persist();
  renderEventForm();
  renderAll();
  toast("已重置");
}

function copyShare() {
  const { title, datetime, location, desc, capacity } = state.event;
  const url = window.location.href.split("#")[0];
  const text = [
    `【${title || "活动"}】邀请你参加`,
    datetime ? `时间：${formatTime(datetime)}` : "",
    location ? `地点：${location}` : "",
    capacity ? `名额：${capacity}` : "",
    desc ? `说明：${desc}` : "",
    `报名链接：${url}`,
  ]
    .filter(Boolean)
    .join("\n");

  navigator.clipboard
    .writeText(text)
    .then(() => toast("已复制分享文案"))
    .catch(() => toast("复制失败，请手动复制"));
}

function downloadIcs() {
  const { title, datetime, location, desc } = state.event;
  if (!title || !datetime) {
    toast("请先填写活动名称和时间");
    return;
  }
  const start = new Date(datetime);
  const end = new Date(start.getTime() + 90 * 60 * 1000);
  const uid = crypto.randomUUID();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//活动管理工具//CN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICS(new Date())}`,
    `DTSTART;TZID=Asia/Shanghai:${formatICS(start)}`,
    `DTEND;TZID=Asia/Shanghai:${formatICS(end)}`,
    `SUMMARY:${escapeICS(title)}`,
    location ? `LOCATION:${escapeICS(location)}` : "",
    desc ? `DESCRIPTION:${escapeICS(desc)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  downloadBlob(lines.join("\r\n"), "text/calendar", "event.ics");
  toast("已生成 .ics");
}

function showQrFor(id) {
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee) return;
  const link = `${window.location.origin}${window.location.pathname}?checkin=${encodeURIComponent(attendee.id)}`;
  refs.qrTitle.textContent = `签到二维码 - ${attendee.name}`;
  refs.qrLink.textContent = link;
  refs.qrContainer.innerHTML = "";
  new QRCode(refs.qrContainer, {
    text: link,
    width: 240,
    height: 240,
  });
  refs.qrLayer.classList.remove("hidden");
}

function hideQr() {
  refs.qrLayer.classList.add("hidden");
  refs.qrContainer.innerHTML = "";
}

function handleCheckinParam() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("checkin");
  if (!id) return;
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee) {
    toast("未找到对应报名记录");
    return;
  }
  toggleCheckin(id);
}

function downloadBlob(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function wrapCsv(str) {
  const s = String(str || "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTime(val) {
  if (!val) return "";
  const date = new Date(val);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function pad(n) {
  return n.toString().padStart(2, "0");
}

function formatICS(date) {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}${m}${d}T${h}${min}${s}`;
}

function escapeICS(str) {
  return String(str || "").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

let toastTimer = null;
function toast(msg) {
  refs.toast.textContent = msg;
  refs.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove("show"), 2200);
}

init();
