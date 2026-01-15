const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const STORAGE_KEY = "activity_tool_v1"; // 兼容本地旧存储，不再使用
const USE_EDGE = typeof EDGE_FUNCTION_URL !== "undefined" && EDGE_FUNCTION_URL;

const state = {
  event: {
    id: "",
    title: "",
    date: "",
    location: "",
    capacity: 50,
    desc: "",
    route: "",
    agenda: [],
    adminHash: "",
  },
  attendees: [],
  adminPassword: "",
  supplies: [],
  expenses: [],
};

const refs = {
  eventTitle: document.getElementById("eventTitle"),
  eventId: document.getElementById("eventId"),
  adminPassword: document.getElementById("adminPassword"),
  eventDate: document.getElementById("eventDate"),
  weekdayLabel: document.getElementById("weekdayLabel"),
  eventLocation: document.getElementById("eventLocation"),
  eventCapacity: document.getElementById("eventCapacity"),
  eventDesc: document.getElementById("eventDesc"),
  eventRoute: document.getElementById("eventRoute"),
  agendaStart: document.getElementById("agendaStart"),
  agendaEnd: document.getElementById("agendaEnd"),
  agendaTitle: document.getElementById("agendaTitle"),
  agendaSpeaker: document.getElementById("agendaSpeaker"),
  agendaNote: document.getElementById("agendaNote"),
  agendaTable: document.getElementById("agendaTable"),
  supplyName: document.getElementById("supplyName"),
  supplyQty: document.getElementById("supplyQty"),
  supplyUnit: document.getElementById("supplyUnit"),
  supplyNote: document.getElementById("supplyNote"),
  supplyTable: document.getElementById("supplyTable"),
  statSuppliesTotal: document.getElementById("statSuppliesTotal"),
  expenseItem: document.getElementById("expenseItem"),
  expenseAmount: document.getElementById("expenseAmount"),
  expenseCategory: document.getElementById("expenseCategory"),
  expensePayer: document.getElementById("expensePayer"),
  expenseNote: document.getElementById("expenseNote"),
  expenseTable: document.getElementById("expenseTable"),
  expenseSummary: document.getElementById("expenseSummary"),
  statExpenseTotal: document.getElementById("statExpenseTotal"),
  statCapacity: document.getElementById("statCapacity"),
  statConfirmed: document.getElementById("statConfirmed"),
  statCheckin: document.getElementById("statCheckin"),
  confirmedTable: document.getElementById("confirmedTable"),
  toast: document.getElementById("toast"),
  qrLayer: document.getElementById("qrLayer"),
  qrContainer: document.getElementById("qrContainer"),
  qrTitle: document.getElementById("qrTitle"),
  qrLink: document.getElementById("qrLink"),
  posterTitle: document.getElementById("posterTitle"),
  posterDate: document.getElementById("posterDate"),
  posterLocation: document.getElementById("posterLocation"),
  posterCapacity: document.getElementById("posterCapacity"),
  posterRoute: document.getElementById("posterRoute"),
  posterDesc: document.getElementById("posterDesc"),
  posterAgenda: document.getElementById("posterAgenda"),
  posterQr: document.getElementById("posterQr"),
  posterLink: document.getElementById("posterLink"),
  posterPreview: document.getElementById("posterPreview"),
};
const pages = Array.from(document.querySelectorAll(".page"));
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));

function loadState() {
  return state;
}

function persist() {
  // 线上模式，持久化由 Supabase 负责；此处不再使用 localStorage
}

function init() {
  bindEvents();
  restoreLocalDefaults();
  setPage("basic");
  handleCheckinParam();
}

function bindEvents() {
  document.getElementById("saveEvent").addEventListener("click", saveEvent);
  document.getElementById("eventForm").addEventListener("submit", (e) => {
    e.preventDefault();
    saveEvent();
  });
  document.getElementById("refreshEvent").addEventListener("click", () => {
    if (!state.event.id) {
      toast("请先填写活动ID");
      return;
    }
    loadEvent(state.event.id);
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
  document.getElementById("closeQr").addEventListener("click", hideQr);
  refs.qrLayer.addEventListener("click", (e) => {
    if (e.target === refs.qrLayer) hideQr();
  });

  document.getElementById("agendaForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addAgendaFromForm();
  });

  document.getElementById("exportPoster").addEventListener("click", exportPoster);
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => setPage(btn.dataset.target));
  });

  document.getElementById("supplyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addSupplyFromForm();
  });
  document.getElementById("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addExpenseFromForm();
  });
  document.getElementById("exportSupplyCsv").addEventListener("click", exportSupplyCsv);
  document.getElementById("exportExpenseCsv").addEventListener("click", exportExpenseCsv);
}

function restoreLocalDefaults() {
  const urlParams = new URLSearchParams(window.location.search);
  const eventParam = urlParams.get("event");
  if (eventParam) {
    refs.eventId.value = eventParam;
    state.event.id = eventParam;
    loadEvent(eventParam);
    return;
  }
}

async function saveEvent() {
  if (!refs.eventId.value.trim()) {
    toast("请填写活动ID");
    return;
  }
  state.event.title = refs.eventTitle.value.trim();
  state.event.date = refs.eventDate.value;
  state.event.location = refs.eventLocation.value.trim();
  state.event.capacity = Math.max(1, Number(refs.eventCapacity.value || 1));
  state.event.desc = refs.eventDesc.value.trim();
  state.event.route = refs.eventRoute.value.trim();
  state.event.id = refs.eventId.value.trim();
  state.adminPassword = refs.adminPassword.value;
  state.event.agenda = Array.isArray(state.event.agenda) ? state.event.agenda : [];
  updateWeekday(state.event.date);
  try {
    await upsertEvent();
  } catch (err) {
    console.error(err);
    toast(err?.message || "保存失败");
  }
}

function renderEventForm() {
  refs.eventTitle.value = state.event.title || "";
  refs.eventId.value = state.event.id || "";
  refs.adminPassword.value = state.adminPassword || "";
  refs.eventDate.value = state.event.date || "";
  updateWeekday(state.event.date);
  refs.eventLocation.value = state.event.location || "";
  refs.eventCapacity.value = state.event.capacity || 50;
  refs.eventDesc.value = state.event.desc || "";
  refs.eventRoute.value = state.event.route || "";
}

function updateWeekday(dateStr) {
  refs.weekdayLabel.textContent = getWeekday(dateStr) || "-";
}

function addAttendeeFromForm() {
  if (!state.event.id) {
    toast("请先填写并保存活动ID");
    return;
  }
  const name = document.getElementById("name").value.trim();
  if (!name) {
    toast("姓名不能为空");
    return;
  }
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const note = document.getElementById("note").value.trim();

  const confirmedCount = state.attendees.length;
  const cap = Number(state.event.capacity || 0);
  if (cap && confirmedCount >= cap) {
    toast("名额已满，请先取消或增加名额");
    return;
  }

  const attendee = {
    id: crypto.randomUUID(),
    name,
    email,
    phone,
    note,
    createdAt: new Date().toISOString(),
    checkin: { done: false, time: null },
  };

  const row = {
    id: attendee.id,
    event_id: state.event.id,
    name,
    email,
    phone,
    note,
    checkin: false,
    checkin_time: null,
  };

  const write = () =>
    supabaseClient.from("attendees").insert(row).then(({ error }) => {
      if (error) throw error;
    });
  const edge = () => edgeCall("add_attendee", row);

  (USE_EDGE ? edge : write)()
    .then(() => {
      state.attendees.push(attendee);
      renderAll();
      document.getElementById("regForm").reset();
      toast("报名成功");
    })
    .catch((err) => {
      console.error(err);
      toast(err.message || "报名失败");
    });
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
  refs.statCheckin.textContent = `签到 ${counts.checkin}`;

  renderAgenda();
  renderTable();
  renderPoster();
  renderSupplies();
  renderExpenses();
}

async function loadEvent(eventId) {
  try {
    const { data: eventRow, error: eventErr } = await supabaseClient
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();
    if (eventErr) throw eventErr;
    if (!eventRow) {
      toast("未找到该活动，将创建新活动");
      state.event = { id: eventId, title: "", date: "", location: "", capacity: 50, desc: "", route: "", agenda: [] };
      state.attendees = [];
      renderEventForm();
      renderAll();
      return;
    }
    state.event = {
      id: eventRow.id,
      title: eventRow.title || "",
      date: eventRow.date || "",
      location: eventRow.location || "",
      capacity: eventRow.capacity || 0,
      desc: eventRow.desc || "",
      route: eventRow.route || "",
      agenda: [],
      adminHash: eventRow.admin_hash || "",
    };
    const { data: agendaRows, error: agendaErr } = await supabaseClient
      .from("agenda")
      .select("*")
      .eq("event_id", eventId)
      .order("start");
    if (agendaErr) throw agendaErr;
    state.event.agenda = (agendaRows || []).map((a) => ({
      id: a.id,
      start: a.start,
      end: a.end,
      title: a.title,
      speaker: a.speaker,
      note: a.note,
    }));
    const { data: supplyRows, error: supplyErr } = await supabaseClient
      .from("supplies")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");
    if (supplyErr) throw supplyErr;
    state.supplies = (supplyRows || []).map((s) => ({
      id: s.id,
      name: s.name,
      qty: s.qty,
      unit: s.unit,
      note: s.note,
    }));
    const { data: expenseRows, error: expenseErr } = await supabaseClient
      .from("expenses")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");
    if (expenseErr) throw expenseErr;
    state.expenses = (expenseRows || []).map((e) => ({
      id: e.id,
      item: e.item,
      amount: Number(e.amount) || 0,
      payer: e.payer,
      note: e.note,
      category: e.category || "其他",
    }));
    const { data: attendeeRows, error: attErr } = await supabaseClient
      .from("attendees")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");
    if (attErr) throw attErr;
    state.attendees = (attendeeRows || []).map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      note: a.note,
      createdAt: a.created_at,
      checkin: { done: a.checkin, time: a.checkin_time },
    }));
    renderEventForm();
    renderAll();
    toast("已加载");
  } catch (err) {
    console.error(err);
    toast("加载失败");
  }
}

function addAgendaFromForm() {
  if (!state.event.id) {
    toast("请先填写活动ID并保存");
    return;
  }
  const start = refs.agendaStart.value;
  const end = refs.agendaEnd.value;
  const title = refs.agendaTitle.value.trim();
  const speaker = refs.agendaSpeaker.value.trim();
  const note = refs.agendaNote.value.trim();
  if (!start || !end || !title) {
    toast("请填写开始、结束、主题");
    return;
  }
  const s = parseTimeMinutes(start);
  const e = parseTimeMinutes(end);
  if (s === null || e === null) {
    toast("时间格式无效");
    return;
  }
  if (e <= s) {
    toast("结束需晚于开始");
    return;
  }
  const item = { id: crypto.randomUUID(), start, end, title, speaker, note };
  state.event.agenda.push(item);
  state.event.agenda.sort((a, b) => parseTimeMinutes(a.start) - parseTimeMinutes(b.start));
  syncAgenda()
    .then(() => {
      renderAgenda();
      renderPoster();
      document.getElementById("agendaForm").reset();
      toast("已添加日程");
    })
    .catch((err) => {
      console.error(err);
      toast("保存日程失败");
    });
}

function renderAgenda() {
  const list = Array.isArray(state.event.agenda) ? state.event.agenda : [];
  if (!list.length) {
    refs.agendaTable.innerHTML = `<div class="muted" style="padding:12px;">暂无日程</div>`;
    return;
  }
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>时间段</th>
      <th>主题</th>
      <th>嘉宾</th>
      <th>备注</th>
      <th>操作</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  list.forEach((a, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(a.start)} - ${escapeHtml(a.end)}</td>
      <td>${escapeHtml(a.title)}</td>
      <td>${a.speaker ? escapeHtml(a.speaker) : "-"}</td>
      <td>${a.note ? escapeHtml(a.note) : "-"}</td>
      <td>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="small ghost" data-action="up" data-id="${a.id}" ${idx === 0 ? "disabled" : ""}>上移</button>
          <button class="small ghost" data-action="down" data-id="${a.id}" ${idx === list.length - 1 ? "disabled" : ""}>下移</button>
          <button class="small danger ghost" data-action="del" data-id="${a.id}">删除</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  refs.agendaTable.innerHTML = "";
  refs.agendaTable.appendChild(table);

  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.action;
    if (action === "del") {
      removeAgenda(id);
    } else if (action === "up") {
      moveAgenda(id, -1);
    } else if (action === "down") {
      moveAgenda(id, 1);
    }
  });
}

function moveAgenda(id, delta) {
  const list = state.event.agenda;
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const target = idx + delta;
  if (target < 0 || target >= list.length) return;
  const [item] = list.splice(idx, 1);
  list.splice(target, 0, item);
  syncAgenda()
    .then(() => {
      renderAgenda();
      renderPoster();
    })
    .catch((err) => {
      console.error(err);
      toast("更新顺序失败");
    });
}

function removeAgenda(id) {
  const list = state.event.agenda;
  const idx = list.findIndex((a) => a.id === id);
  if (idx === -1) return;
  list.splice(idx, 1);
  syncAgenda()
    .then(() => {
      renderAgenda();
      renderPoster();
      toast("已删除日程");
    })
    .catch((err) => {
      console.error(err);
      toast("删除失败");
    });
}

function renderPoster() {
  if (!refs.posterPreview) return;
  const { title, date, location, capacity, route, desc } = state.event;
  refs.posterTitle.textContent = title || "活动";
  refs.posterDate.textContent = formatDateLine(date).replace(/^时间：/, "") || "-";
  refs.posterLocation.textContent = location || "-";
  refs.posterCapacity.textContent = capacity ? `${capacity} 人` : "-";
  refs.posterRoute.textContent = route || "-";
  refs.posterDesc.textContent = desc || "-";

  refs.posterAgenda.innerHTML = "";
  const agenda = Array.isArray(state.event.agenda) ? state.event.agenda : [];
  if (!agenda.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "暂无日程";
    refs.posterAgenda.appendChild(li);
  } else {
    agenda.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = formatAgendaLine(item);
      refs.posterAgenda.appendChild(li);
    });
  }

  const link = getShareLink();
  refs.posterLink.textContent = link;
  refs.posterQr.innerHTML = "";
  new QRCode(refs.posterQr, {
    text: link,
    width: 150,
    height: 150,
  });
}

function getCounts() {
  return state.attendees.reduce(
    (acc, cur) => {
      acc.confirmed += 1;
      if (cur.checkin?.done) acc.checkin += 1;
      return acc;
    },
    { confirmed: 0, checkin: 0 }
  );
}

function renderTable() {
  const container = refs.confirmedTable;
  const rows = state.attendees;
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
          <button class="small ghost" data-action="checkin" data-id="${a.id}">${a.checkin?.done ? "已签到" : "签到"}</button>
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
    if (action === "cancel") cancelAttendee(id);
    if (action === "qr") showQrFor(id);
  });
}

function renderStatusBadge(a) {
  if (a.checkin?.done) {
    return `<span class="badge green">已签到</span>`;
  }
  return `<span class="badge gray">待签到</span>`;
}

function toggleCheckin(id) {
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee) return;
  attendee.checkin = {
    done: true,
    time: attendee.checkin?.time || new Date().toISOString(),
  };
  const write = () =>
    supabaseClient
      .from("attendees")
      .update({ checkin: true, checkin_time: attendee.checkin.time })
      .eq("id", id)
      .eq("event_id", state.event.id)
      .then(({ error }) => {
        if (error) throw error;
      });
  const edge = () => edgeCall("checkin_attendee", { id });

  (USE_EDGE ? edge : write)()
    .then(() => {
      renderAll();
      toast(`已签到：${attendee.name}`);
    })
    .catch((err) => {
      console.error(err);
      toast("签到失败");
    });
}

function cancelAttendee(id) {
  const idx = state.attendees.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const name = state.attendees[idx].name;
  const write = () =>
    supabaseClient.from("attendees").delete().eq("id", id).eq("event_id", state.event.id).then(({ error }) => {
      if (error) throw error;
    });
  const edge = () => edgeCall("delete_attendee", { id });

  (USE_EDGE ? edge : write)()
    .then(() => {
      state.attendees.splice(idx, 1);
      renderAll();
      toast(`已取消：${name}`);
    })
    .catch((err) => {
      console.error(err);
      toast("取消失败");
    });
}

function exportCsv() {
  const headers = ["姓名", "邮箱", "手机号", "备注", "状态", "签到", "时间"];
  const rows = state.attendees.map((a) => [
    wrapCsv(a.name),
    wrapCsv(a.email || ""),
    wrapCsv(a.phone || ""),
    wrapCsv(a.note || ""),
    wrapCsv("已报名"),
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
      if (!state.event.date && state.event.start) {
        state.event.date = state.event.start.split("T")[0] || "";
      }
      if (!state.event.date && state.event.datetime) {
        state.event.date = state.event.datetime.split("T")[0] || "";
      }
      state.event.date ||= "";
      state.event.route ||= "";
      state.event.agenda = Array.isArray(state.event.agenda) ? state.event.agenda : [];
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
  state.event = { title: "", date: "", location: "", capacity: 50, desc: "", route: "", agenda: [] };
  state.attendees = [];
  persist();
  renderEventForm();
  renderAll();
  toast("已重置");
}

function copyShare() {
  const { title, date, location, desc, route, capacity } = state.event;
  const url = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(
    state.event.id || ""
  )}`;
  const agendaLines = (state.event.agenda || []).map(formatAgendaLine);
  const text = [
    `【${title || "活动"}】邀请你参加`,
    formatDateLine(date),
    location ? `地点：${location}` : "",
    route ? `到达：${route}` : "",
    capacity ? `名额：${capacity}` : "",
    desc ? `说明：${desc}` : "",
    agendaLines.length ? "日程：" : "",
    ...agendaLines,
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
  const { title, date, location, desc, route } = state.event;
  if (!title || !date) {
    toast("请先填写活动名称与日期");
    return;
  }
  const agenda = Array.isArray(state.event.agenda) ? state.event.agenda : [];
  const defaultStart = "09:00";
  const defaultEnd = "18:00";
  const firstStart = agenda.length ? agenda.map((a) => a.start).sort()[0] : defaultStart;
  const lastEnd = agenda.length ? agenda.map((a) => a.end).sort().slice(-1)[0] : defaultEnd;
  const startDate = combineDateTime(date, firstStart);
  const endDate = combineDateTime(date, lastEnd);
  if (!startDate || !endDate || endDate <= startDate) {
    toast("日程时间有误，请检查");
    return;
  }
  const uid = crypto.randomUUID();
  const agendaLines = (state.event.agenda || []).map(formatAgendaLine);
  const descText = [desc || "", route ? `到达：${route}` : "", agendaLines.length ? "日程：" : "", ...agendaLines]
    .filter(Boolean)
    .join("\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//活动管理工具//CN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICS(new Date())}`,
    `DTSTART;TZID=Asia/Shanghai:${formatICS(startDate)}`,
    `DTEND;TZID=Asia/Shanghai:${formatICS(endDate)}`,
    `SUMMARY:${escapeICS(title)}`,
    location ? `LOCATION:${escapeICS(location)}` : "",
    descText ? `DESCRIPTION:${escapeICS(descText)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);

  downloadBlob(lines.join("\r\n"), "text/calendar", "event.ics");
  toast("已生成 .ics");
}

function showQrFor(id) {
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee) return;
  const link = `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(
    state.event.id || ""
  )}&checkin=${encodeURIComponent(attendee.id)}`;
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
  const eventParam = params.get("event");
  if (eventParam) {
    state.event.id = eventParam;
    refs.eventId.value = eventParam;
    loadEvent(eventParam).then(() => {
      const id = params.get("checkin");
      if (id) toggleCheckin(id);
    });
    return;
  }
  const id = params.get("checkin");
  if (!id) return;
  const attendee = state.attendees.find((a) => a.id === id);
  if (!attendee) {
    toast("未找到对应报名记录");
    return;
  }
  toggleCheckin(id);
}

function setPage(target) {
  pages.forEach((p) => {
    if (p.dataset.page === target) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
  tabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.target === target);
  });
}

function exportPoster() {
  if (!window.html2canvas) {
    toast("海报导出组件加载失败，请稍后重试");
    return;
  }
  html2canvas(refs.posterPreview, { scale: 2, useCORS: true })
    .then((canvas) => {
      const url = canvas.toDataURL("image/png");
      downloadBlob(dataURLToBlob(url), "image/png", "活动海报.png");
    })
    .catch((err) => {
      console.error(err);
      toast("导出失败，请重试");
    });
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

function getShareLink() {
  return `${window.location.origin}${window.location.pathname}?event=${encodeURIComponent(
    state.event.id || ""
  )}`;
}

function dataURLToBlob(dataUrl) {
  const arr = dataUrl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) {
    u8[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8], { type: mime });
}

async function edgeCall(action, payload) {
  if (!EDGE_FUNCTION_URL) {
    throw new Error("未配置 Edge Function");
  }
  const admin_password = state.adminPassword || refs.adminPassword.value;
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      action,
      event_id: state.event.id,
      admin_password,
      payload,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "写入失败");
  }
  return data;
}

async function hashPassword(pwd) {
  const enc = new TextEncoder().encode(pwd);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureAdminAuth() {
  const pwd = refs.adminPassword.value || state.adminPassword;
  if (!pwd) {
    throw new Error("请填写管理密码");
  }
  const hash = await hashPassword(pwd);
  if (state.event.adminHash && state.event.adminHash !== hash) {
    throw new Error("管理密码不正确");
  }
  state.adminPassword = pwd;
  state.event.adminHash = hash;
  return hash;
}

async function upsertEvent() {
  if (!state.event.id) throw new Error("缺少活动ID");
  const hash = await ensureAdminAuth();
  const payload = {
    id: state.event.id,
    title: state.event.title,
    date: state.event.date,
    location: state.event.location,
    capacity: state.event.capacity,
    desc: state.event.desc,
    route: state.event.route,
    admin_hash: hash,
  };
  if (USE_EDGE) {
    await edgeCall("upsert_event", { event: payload, agenda: state.event.agenda, supplies: state.supplies, expenses: state.expenses });
  } else {
    const { error } = await supabaseClient.from("events").upsert(payload);
    if (error) throw error;
    await syncAgenda();
  }
  renderAll();
  toast("活动信息已保存");
}

async function syncAgenda() {
  if (!state.event.id) throw new Error("缺少活动ID");
  await ensureAdminAuth();
  if (USE_EDGE) {
    await edgeCall("set_agenda", { agenda: state.event.agenda });
    return;
  }
  const agenda = Array.isArray(state.event.agenda) ? state.event.agenda : [];
  await supabaseClient.from("agenda").delete().eq("event_id", state.event.id);
  if (agenda.length === 0) return;
  const rows = agenda.map((a) => ({
    id: a.id || crypto.randomUUID(),
    event_id: state.event.id,
    start: a.start,
    end: a.end,
    title: a.title,
    speaker: a.speaker,
    note: a.note,
  }));
  const { error } = await supabaseClient.from("agenda").insert(rows);
  if (error) throw error;
}

async function addSupplyFromForm() {
  if (!state.event.id) {
    toast("请先填写活动ID并保存");
    return;
  }
  try {
    await ensureAdminAuth();
    const name = refs.supplyName.value.trim();
    const qty = Number(refs.supplyQty.value || 0);
    if (!name || qty <= 0) {
      toast("请填写物资名称和数量");
      return;
    }
    const unit = refs.supplyUnit.value.trim();
    const note = refs.supplyNote.value.trim();
    const row = {
      id: crypto.randomUUID(),
      event_id: state.event.id,
      name,
      qty,
      unit,
      note,
    };
    if (USE_EDGE) {
      await edgeCall("add_supply", row);
    } else {
      const { error } = await supabaseClient.from("supplies").insert(row);
      if (error) throw error;
    }
    state.supplies.push({ id: row.id, name, qty, unit, note });
    renderSupplies();
    document.getElementById("supplyForm").reset();
    toast("已添加物资");
  } catch (err) {
    console.error(err);
    toast(err.message || "添加失败");
  }
}

async function removeSupply(id) {
  try {
    await ensureAdminAuth();
    if (USE_EDGE) {
      await edgeCall("delete_supply", { id });
    } else {
      await supabaseClient.from("supplies").delete().eq("id", id).eq("event_id", state.event.id);
    }
    state.supplies = state.supplies.filter((s) => s.id !== id);
    renderSupplies();
    toast("已删除物资");
  } catch (err) {
    console.error(err);
    toast("删除失败");
  }
}

async function addExpenseFromForm() {
  if (!state.event.id) {
    toast("请先填写活动ID并保存");
    return;
  }
  try {
    await ensureAdminAuth();
    const item = refs.expenseItem.value.trim();
    const amount = Number(refs.expenseAmount.value || 0);
    const category = refs.expenseCategory.value || "其他";
    if (!item || amount < 0) {
      toast("请填写项目与金额");
      return;
    }
    const payer = refs.expensePayer.value.trim();
    const note = refs.expenseNote.value.trim();
    const row = {
      id: crypto.randomUUID(),
      event_id: state.event.id,
      item,
      amount,
      category,
      payer,
      note,
    };
    if (USE_EDGE) {
      await edgeCall("add_expense", row);
    } else {
      const { error } = await supabaseClient.from("expenses").insert(row);
      if (error) throw error;
    }
    state.expenses.push({ id: row.id, item, amount, category, payer, note });
    renderExpenses();
    document.getElementById("expenseForm").reset();
    toast("已记录费用");
  } catch (err) {
    console.error(err);
    toast(err.message || "记录失败");
  }
}

async function removeExpense(id) {
  try {
    await ensureAdminAuth();
    if (USE_EDGE) {
      await edgeCall("delete_expense", { id });
    } else {
      await supabaseClient.from("expenses").delete().eq("id", id).eq("event_id", state.event.id);
    }
    state.expenses = state.expenses.filter((e) => e.id !== id);
    renderExpenses();
    toast("已删除费用");
  } catch (err) {
    console.error(err);
    toast("删除失败");
  }
}

function renderSupplies() {
  const list = Array.isArray(state.supplies) ? state.supplies : [];
  refs.statSuppliesTotal.textContent = `物资项 ${list.length}`;
  if (!list.length) {
    refs.supplyTable.innerHTML = `<div class="muted" style="padding:12px;">暂无物资</div>`;
    return;
  }
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>名称</th>
        <th>数量</th>
        <th>备注</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${list
        .map(
          (s) => `
        <tr>
          <td>${escapeHtml(s.name)}</td>
          <td>${s.qty} ${s.unit ? escapeHtml(s.unit) : ""}</td>
          <td>${s.note ? escapeHtml(s.note) : "-"}</td>
          <td><button class="small danger ghost" data-action="del-supply" data-id="${s.id}">删除</button></td>
        </tr>`
        )
        .join("")}
    </tbody>
  `;
  refs.supplyTable.innerHTML = "";
  refs.supplyTable.appendChild(table);
  table.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.action === "del-supply") removeSupply(btn.dataset.id);
  });
}

function renderExpenses() {
  const list = Array.isArray(state.expenses) ? state.expenses : [];
  const total = list.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  refs.statExpenseTotal.textContent = `合计 ￥${total.toFixed(2)}`;
  if (!list.length) {
    refs.expenseTable.innerHTML = `<div class="muted" style="padding:12px;">暂无费用</div>`;
    refs.expenseSummary.textContent = "";
    return;
  }
  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>项目</th>
        <th>金额</th>
        <th>分类</th>
        <th>支付</th>
        <th>备注</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      ${list
        .map(
          (e) => `
        <tr>
          <td>${escapeHtml(e.item)}</td>
          <td>￥${Number(e.amount || 0).toFixed(2)}</td>
          <td>${escapeHtml(e.category || "其他")}</td>
          <td>${e.payer ? escapeHtml(e.payer) : "-"}</td>
          <td>${e.note ? escapeHtml(e.note) : "-"}</td>
          <td><button class="small danger ghost" data-action="del-expense" data-id="${e.id}">删除</button></td>
        </tr>`
        )
        .join("")}
    </tbody>
  `;
  refs.expenseTable.innerHTML = "";
  refs.expenseTable.appendChild(table);
  const summary = list.reduce((acc, e) => {
    const key = e.category || "其他";
    acc[key] = (acc[key] || 0) + Number(e.amount || 0);
    return acc;
  }, {});
  const lines = Object.entries(summary)
    .map(([cat, amt]) => `${cat}: ￥${amt.toFixed(2)}`)
    .join("，");
  refs.expenseSummary.textContent = lines ? `分类汇总：${lines}` : "";
  table.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.action === "del-expense") removeExpense(btn.dataset.id);
  });
}

function exportSupplyCsv() {
  const headers = ["名称", "数量", "单位", "备注"];
  const rows = (state.supplies || []).map((s) => [
    wrapCsv(s.name),
    wrapCsv(s.qty),
    wrapCsv(s.unit || ""),
    wrapCsv(s.note || ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadBlob(csv, "text/csv;charset=utf-8", "物资清单.csv");
}

function exportExpenseCsv() {
  const headers = ["项目", "金额", "分类", "支付", "备注"];
  const rows = (state.expenses || []).map((e) => [
    wrapCsv(e.item),
    wrapCsv(Number(e.amount || 0).toFixed(2)),
    wrapCsv(e.category || "其他"),
    wrapCsv(e.payer || ""),
    wrapCsv(e.note || ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  downloadBlob(csv, "text/csv;charset=utf-8", "费用清单.csv");
}

function parseTimeMinutes(val) {
  if (!val || typeof val !== "string") return null;
  const [h, m] = val.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function combineDateTime(dateStr, hmStr) {
  if (!dateStr || !hmStr) return null;
  const [h, m] = hmStr.split(":").map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const d = new Date(`${dateStr}T${hmStr}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatAgendaLine(item) {
  const time = `${item.start} - ${item.end}`;
  const speaker = item.speaker ? ` / ${item.speaker}` : "";
  const note = item.note ? `（${item.note}）` : "";
  return `${time} ${item.title}${speaker}${note}`;
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateLine(date) {
  if (!date) return "";
  const weekday = getWeekday(date);
  return `时间：${date}${weekday ? `（${weekday}）` : ""}`;
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

function getWeekday(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const w = d.getDay();
  const map = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return map[w] || "";
}

let toastTimer = null;
function toast(msg) {
  refs.toast.textContent = msg;
  refs.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => refs.toast.classList.remove("show"), 2200);
}

init();
