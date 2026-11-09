const state={role:'user',page:'dashboard',name:'Vedant Sharma',email:'',age:null,hospital:null,hospitals:[],adminReports:[],appointments:[],reports:[],prescriptions:[],pendingPrescriptions:[],invoices:[],patients:[],analytics:null,womensHealth:null,womensHealthAnswer:null,search:''};
const patientAppointments=[
 {name:'Dr. Ananya Mehta',dept:'Cardiology',date:'Today, 10:30 AM',status:'Confirmed',type:'Follow-up'},
 {name:'Dr. Rahul Kapoor',dept:'General Medicine',date:'Tomorrow, 2:00 PM',status:'Pending',type:'Consultation'},
 {name:'Dr. Priya Nair',dept:'Dermatology',date:'Oct 30, 11:15 AM',status:'Confirmed',type:'Review'}
];
const adminAppointments=[
 {name:'Aarav Malhotra',dept:'Cardiology · Dr. Mehta',date:'09:00 AM',status:'Confirmed',type:'Follow-up'},
 {name:'Meera Sharma',dept:'General Medicine · Dr. Kapoor',date:'09:30 AM',status:'Pending',type:'Consultation'},
 {name:'Kabir Singh',dept:'Dermatology · Dr. Nair',date:'10:15 AM',status:'Confirmed',type:'Review'},
 {name:'Anaya Verma',dept:'Orthopaedics · Dr. Rao',date:'11:00 AM',status:'Confirmed',type:'Consultation'}
];
const doctors=[
 {name:'Dr. Ananya Mehta',dept:'Cardiology',exp:'12 years experience',time:'Today · 10:30 AM',symbol:'♡'},
 {name:'Dr. Rahul Kapoor',dept:'General Medicine',exp:'9 years experience',time:'Today · 12:00 PM',symbol:'✚'},
 {name:'Dr. Priya Nair',dept:'Dermatology',exp:'8 years experience',time:'Tomorrow · 11:15 AM',symbol:'✧'},
 {name:'Dr. Vikram Rao',dept:'Orthopaedics',exp:'15 years experience',time:'Tomorrow · 3:00 PM',symbol:'⌁'},
 {name:'Dr. Sana Khan',dept:'Paediatrics',exp:'10 years experience',time:'Oct 30 · 9:45 AM',symbol:'♡'},
 {name:'Dr. Arjun Das',dept:'Neurology',exp:'11 years experience',time:'Oct 31 · 1:30 PM',symbol:'✚'}
];
const userNav=[['dashboard','⌂','Overview'],['appointments','▦','My appointments'],['doctors','✚','Find a doctor'],['records','▤','Health records'],['ai','✧','Reports & AI'],['prescriptions','♧','Prescriptions'],['billing','＄','Bills & payments'],['faq','?','FAQs'],['settings','⚙','My profile']];
const adminNav=[['dashboard','⌂','Overview'],['appointments','▦','Appointments'],['patients','♙','Patients'],['doctors','✚','Doctors & departments'],['staff','♧','Staff management'],['prescriptions','♧','Prescriptions'],['billing','＄','Billing'],['reports','▥','Reports & analytics'],['hospitals','⌂','Hospitals'],['faq','?','FAQs'],['settings','⚙','Account settings']];
function openAuth(role='user'){if(role==='admin'&&authMode==='register')toggleAuthMode();setRole(role);document.getElementById('authOverlay').classList.remove('hidden');document.getElementById('loginError').textContent='';}
function closeAuth(){document.getElementById('authOverlay').classList.add('hidden')}
function setRole(role){state.role=role;document.getElementById('roleUser').classList.toggle('active',role==='user');document.getElementById('roleAdmin').classList.toggle('active',role==='admin');document.getElementById('loginError').textContent='';}
function login(e){e.preventDefault();const email=document.getElementById('email').value.trim();const pass=document.getElementById('password').value;if(!email||pass.length<4){document.getElementById('loginError').textContent='Please enter a valid email and a password with at least 4 characters.';return;}state.email=email;state.name=state.role==='admin'?'Hospital Administrator':(email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Patient');closeAuth();document.getElementById('landing').classList.add('hidden');document.getElementById('app').classList.remove('hidden');document.getElementById('profileName').textContent=state.name;document.getElementById('profileRole').textContent=state.role==='admin'?'Administrator':'Patient account';document.getElementById('avatarInitials').textContent=state.role==='admin'?'AD':state.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();buildNav();renderAll();go('dashboard');}
function logout(){document.getElementById('app').classList.add('hidden');document.getElementById('landing').classList.remove('hidden');document.getElementById('sidebar').classList.remove('open');state.page='dashboard';}
function buildNav(){const nav=state.role==='admin'?adminNav:(state.womensHealth?.enabled?[...userNav,['womens-health','♡','Women’s health']]:userNav);document.getElementById('navItems').innerHTML=nav.map(([id,ico,label])=>`<button class="nav-item ${state.page===id?'active':''}" onclick="go('${id}')"><span class="nav-ico">${ico}</span>${label}</button>`).join('');}
function go(page){state.page=page;document.querySelectorAll('.page-section').forEach(x=>x.classList.remove('active'));const section=document.getElementById('page-'+page);if(section)section.classList.add('active');document.getElementById('topPage').textContent=({dashboard:'Overview',appointments:state.role==='admin'?'Appointments':'My appointments',doctors:state.role==='admin'?'Doctors & departments':'Find a doctor',records:'Health records',ai:'Reports & AI usage',prescriptions:'Prescriptions',billing:state.role==='admin'?'Billing':'Bills & payments',patients:'Patients',staff:'Staff management',reports:'Reports & analytics',hospitals:'Hospitals',faq:'FAQs',settings:state.role==='admin'?'Account settings':'My profile','womens-health':'Women’s health'})[page]||'Overview';buildNav();document.getElementById('sidebar').classList.remove('open');}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open')}
function toast(message){const el=document.getElementById('toast');el.textContent=message;el.classList.remove('hidden');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.add('hidden'),3000)}
function stat(title,value,icon,foot){return `<article class="stat-card"><div class="stat-head"><span>${title}</span><span class="stat-icon">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-foot">${foot}</div></article>`}
function panelHead(title,sub='',action=''){return `<div class="panel-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div>${action}</div>`}
function appointmentsTable(rows,admin=false){return `<div class="table-wrap"><table><thead><tr><th>${admin?'Patient':'Doctor'}</th><th>${admin?'Department / clinician':'Specialty'}</th><th>Date & time</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((a,i)=>`<tr><td><div class="person-cell"><div class="patient-avatar">${(a.name.match(/\b\w/g)||[]).slice(0,2).join('')}</div><div><strong>${a.name}</strong><small>${a.type||'Consultation'}</small></div></div></td><td>${a.dept}</td><td>${a.date}</td><td><span class="status ${a.status.toLowerCase()}">${a.status}</span></td><td><button class="link-btn" onclick="appointmentAction(${i})">${admin?'Manage':'View details'}</button></td></tr>`).join('')}</tbody></table></div>`}
function appointmentAction(i){toast(state.role==='admin'?'Appointment record opened (demo).':'Appointment details opened (demo).')}
function chart(){const heights=[44,61,52,76,63,88,70];return `<div class="chart">${heights.map((h,i)=>`<div class="bar-col"><div class="bar-pair"><div class="bar" style="height:${Math.max(15,h-22)}%"></div><div class="bar dark" style="height:${h}%"></div></div><div class="bar-label">${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</div></div>`).join('')}</div><div style="display:flex;gap:16px;margin-top:14px;font-size:10px;color:var(--muted)"><span><span style="display:inline-block;width:8px;height:8px;background:#bde7d2;border-radius:2px;margin-right:5px"></span>Previous week</span><span><span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:2px;margin-right:5px"></span>This week</span></div>`}
function userDashboard(){const rows=state.appointments.length?[...state.appointments,...patientAppointments]:patientAppointments;return `<div class="welcome"><div><h1>Good day, ${state.name.split(' ')[0]} 👋</h1><p>Here’s your personal health overview. Take a moment for your wellbeing.</p></div><div class="welcome-actions"><button class="btn btn-outline" onclick="go('doctors')">Find a doctor</button><button class="btn btn-primary" onclick="bookAppointment()">＋ Book appointment</button></div></div>
<div class="stats">${stat('Upcoming appointments','03','▦','<span class="up">Next: Today, 10:30 AM</span>')}${stat('Health records','08','▤','Updated recently')}${stat('Active prescriptions','02','♧','1 refill may be due soon')}${stat('Outstanding balance','₹850','＄','<span class="down">Payment due</span>')}</div>
<div class="dashboard-grid"><div class="panel">${panelHead('Your health journey','A simple view of your activity over the week')}<div style="display:flex;align-items:baseline;gap:10px;margin:10px 0 0"><span style="font-size:25px;font-weight:850">Good progress</span><span class="status active">On track</span></div><p style="font-size:11px;color:var(--muted);margin:5px 0">Keep up with your appointments and care plan.</p>${chart()}</div><div class="panel">${panelHead('Next appointment','Your next step in care')}<div style="padding:18px;background:#f1faf5;border:1px solid #e0f1e7;border-radius:15px"><div style="display:flex;gap:12px;align-items:center"><div class="patient-avatar" style="width:49px;height:49px;font-size:18px">♡</div><div><strong style="font-size:13px">Dr. Ananya Mehta</strong><div style="font-size:11px;color:var(--muted);margin-top:5px">Cardiology</div></div></div><div style="margin:17px 0 14px;font-size:12px;color:#45695a">▦ &nbsp; Today · 10:30 AM<br><span style="display:inline-block;margin-top:9px">⌖ &nbsp; Outpatient clinic · Room 204</span></div><button class="btn btn-primary full" onclick="go('appointments')">View appointment</button></div><div style="margin-top:15px;padding:5px 2px"><div style="font-weight:800;font-size:12px;margin-bottom:6px">Before you visit</div><div style="font-size:11px;color:var(--muted);line-height:1.6">Bring your ID and any recent reports. Arrive 15 minutes early.</div></div></div></div>
<div class="panel" style="margin-bottom:20px">${panelHead('Upcoming appointments','Your scheduled visits','<button class="link-btn" onclick="go(&quot;appointments&quot;)">See all →</button>')}${appointmentsTable(rows.slice(0,3),false)}</div>
<div class="panel">${panelHead('Quick actions','The things you may need most')}<div class="quick-grid">${quick('＋','Book an appointment','Choose a care specialist', "bookAppointment()")}${quick('▤','View health records','Reports and visit history',"go('records')")}${quick('♧','Prescriptions','Medication information',"go('prescriptions')")}${quick('＄','Pay a bill','Review your balance',"go('billing')")}</div></div>`}
function adminDashboard(){const rows=adminAppointments;return `<div class="welcome"><div><h1>Hospital overview 👋</h1><p>Monitor today's activity and keep care operations running smoothly.</p></div><div class="welcome-actions"><button class="btn btn-outline" onclick="go('reports')">Export report ↓</button><button class="btn btn-primary" onclick="addPatient()">＋ Register patient</button></div></div>
<div class="stats">${stat('Total patients','2,486','♙','<span class="up">↑ 8.2%</span> vs last month')}${stat("Today's appointments",'64','▦','<span class="up">↑ 12%</span> vs last week')}${stat('Available doctors','28','✚','Across 9 departments')}${stat('Pending payments','₹42.8K','＄','<span class="down">18 invoices</span> awaiting')}</div>
<div class="dashboard-grid"><div class="panel">${panelHead('Appointment activity','Weekly appointment volume')}<div style="display:flex;align-items:baseline;gap:10px;margin:10px 0 0"><span style="font-size:25px;font-weight:850">428</span><span class="status active">+12.4%</span></div><p style="font-size:11px;color:var(--muted);margin:5px 0">Appointments recorded this week</p>${chart()}</div><div class="panel">${panelHead('Hospital snapshot','Live operations · demo data')}<div class="appointment-list"><div class="appointment"><div class="stat-icon">✚</div><div class="appointment-info"><strong>Outpatient departments</strong><span>9 departments operational</span></div><span class="status active">Open</span></div><div class="appointment"><div class="stat-icon">♙</div><div class="appointment-info"><strong>Patient admissions</strong><span>12 awaiting review</span></div><span class="status pending">Review</span></div><div class="appointment"><div class="stat-icon">▤</div><div class="appointment-info"><strong>Pending lab reports</strong><span>7 reports to verify</span></div><span class="status pending">Pending</span></div><div class="appointment"><div class="stat-icon">＄</div><div class="appointment-info"><strong>Billing queue</strong><span>18 invoices need attention</span></div><span class="status critical">Action</span></div></div></div></div>
<div class="panel" style="margin-bottom:20px">${panelHead('Today’s appointments','Upcoming scheduled visits','<button class="link-btn" onclick="go(&quot;appointments&quot;)">Manage schedule →</button>')}${appointmentsTable(rows,true)}</div><div class="panel">${panelHead('Quick operations','Frequently used administrator tools')}<div class="quick-grid">${quick('♙','Register patient','Add a patient profile','addPatient()')}${quick('▦','Manage appointments','Review daily schedule',"go('appointments')")}${quick('♧','Staff management','View care team',"go('staff')")}${quick('▥','Reports & analytics','Review hospital activity',"go('reports')")}</div></div>`}
function quick(icon,title,desc,action){return `<button class="quick-action" onclick="${action}"><div class="qa-icon">${icon}</div><strong>${title}</strong><span>${desc}</span></button>`}
function renderAppointments(){const admin=state.role==='admin';const rows=admin?adminAppointments:(state.appointments.length?[...state.appointments,...patientAppointments]:patientAppointments);return `<div class="welcome"><div><h1>${admin?'Appointment management':'My appointments'}</h1><p>${admin?'Review and manage the hospital schedule.':'Keep track of your upcoming and previous visits.'}</p></div><button class="btn btn-primary" onclick="${admin?'addPatient()':'bookAppointment()'}">＋ ${admin?'Add appointment':'Book appointment'}</button></div><div class="panel"><div class="searchbar"><input placeholder="Search by ${admin?'patient or doctor':'doctor or specialty'}…" oninput="filterTable(this.value)"><select onchange="filterStatus(this.value)"><option value="all">All statuses</option><option>Confirmed</option><option>Pending</option><option>Completed</option></select></div><div id="appointmentTable">${appointmentsTable(rows,admin)}</div></div>`}
function renderDoctors(){return `<div class="welcome"><div><h1>${state.role==='admin'?'Doctors & departments':'Find your doctor'}</h1><p>${state.role==='admin'?'Review clinical staff and department availability.':'Choose a specialist for your next visit.'}</p></div>${state.role==='admin'?'<button class="btn btn-primary" onclick="toast(&quot;Staff onboarding form is a backend integration point.&quot;)">＋ Add doctor</button>':''}</div><div class="searchbar"><input placeholder="Search doctors or specialties…" oninput="filterDoctors(this.value)"><select onchange="filterDepartment(this.value)"><option value="all">All specialties</option><option>Cardiology</option><option>General Medicine</option><option>Dermatology</option><option>Orthopaedics</option><option>Paediatrics</option><option>Neurology</option></select></div><div id="doctorGrid" class="doctor-card-grid">${doctorCards(doctors)}</div>`}
function doctorCards(items){return items.map(d=>`<article class="doctor-card"><div class="doctor-photo">${d.symbol}</div><h3>${d.name}</h3><p>${d.dept}</p><div class="doctor-meta">✧ &nbsp; ${d.exp}</div><div class="doctor-meta">◷ &nbsp; ${d.time}</div><button class="btn btn-light full" style="margin-top:10px" onclick="${state.role==='admin'?'toast(&quot;Doctor profile opened (demo).&quot;)':'bookAppointment(&quot;'+d.name+'&quot;)'}">${state.role==='admin'?'View profile':'Book appointment'} →</button></article>`).join('')}
function filterDoctors(q){const filtered=doctors.filter(d=>(d.name+' '+d.dept).toLowerCase().includes(q.toLowerCase()));document.getElementById('doctorGrid').innerHTML=filtered.length?doctorCards(filtered):'<div class="empty-state"><div>⌕</div><strong>No doctors found</strong><p>Try another name or specialty.</p></div>'}
function filterDepartment(dep){const filtered=dep==='all'?doctors:doctors.filter(d=>d.dept===dep);document.getElementById('doctorGrid').innerHTML=filtered.length?doctorCards(filtered):'<div class="empty-state"><strong>No doctors in this specialty</strong></div>'}
function renderRecords(){if(state.role==='admin'){return `<div class="welcome"><div><h1>Patient directory</h1><p>Sample patient data for demonstration only.</p></div><button class="btn btn-primary" onclick="addPatient()">＋ Register patient</button></div>${patientDirectory()}`}return `<div class="welcome"><div><h1>Health records</h1><p>Your visit summaries, test results, and important health documents in one place.</p></div><button class="btn btn-primary" onclick="toast('Upload is a demo action. A secure document service is required.')">↑ Upload document</button></div><div class="notice">Your health information is sensitive. This prototype uses sample data and is not connected to a medical records system.</div><div class="panel">${panelHead('Recent records','Example records shown for interface demonstration')}<div class="table-wrap"><table><thead><tr><th>Record</th><th>Department</th><th>Date</th><th>Status</th><th></th></tr></thead><tbody><tr><td><div class="person-cell"><div class="patient-avatar">▤</div><div><strong>Complete blood count</strong><small>Laboratory report</small></div></div></td><td>Pathology</td><td>Oct 18, 2026</td><td><span class="status completed">Available</span></td><td><button class="link-btn" onclick="toast('Sample report preview is not connected.')">View</button></td></tr><tr><td><div class="person-cell"><div class="patient-avatar">♡</div><div><strong>Cardiology consultation</strong><small>Visit summary</small></div></div></td><td>Cardiology</td><td>Oct 12, 2026</td><td><span class="status completed">Available</span></td><td><button class="link-btn" onclick="toast('Sample visit summary is not connected.')">View</button></td></tr><tr><td><div class="person-cell"><div class="patient-avatar">⌁</div><div><strong>Vitamin D test</strong><small>Laboratory report</small></div></div></td><td>Pathology</td><td>Oct 04, 2026</td><td><span class="status pending">Processing</span></td><td><button class="link-btn" onclick="toast('This sample report is still processing.')">Track</button></td></tr></tbody></table></div></div>`}
function patientDirectory(){return `<div class="panel"><div class="searchbar"><input placeholder="Search patient name or ID…" oninput="filterTable(this.value)"><select><option>All patients</option><option>Active</option><option>Follow-up</option></select></div><div class="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Last visit</th><th>Care status</th><th>Action</th></tr></thead><tbody id="patientRows"><tr><td><div class="person-cell"><div class="patient-avatar">AM</div><div><strong>Aarav Malhotra</strong><small>aarav@example.com</small></div></div></td><td>CS-1024</td><td>Oct 24, 2026</td><td><span class="status active">Active</span></td><td><button class="link-btn" onclick="toast('Patient profile opened (demo).')">View</button></td></tr><tr><td><div class="person-cell"><div class="patient-avatar">MS</div><div><strong>Meera Sharma</strong><small>meera@example.com</small></div></div></td><td>CS-1025</td><td>Oct 23, 2026</td><td><span class="status pending">Follow-up</span></td><td><button class="link-btn" onclick="toast('Patient profile opened (demo).')">View</button></td></tr><tr><td><div class="person-cell"><div class="patient-avatar">KS</div><div><strong>Kabir Singh</strong><small>kabir@example.com</small></div></div></td><td>CS-1026</td><td>Oct 22, 2026</td><td><span class="status active">Active</span></td><td><button class="link-btn" onclick="toast('Patient profile opened (demo).')">View</button></td></tr></tbody></table></div></div>`}
function renderPrescriptions(){return `<div class="welcome"><div><h1>Prescriptions</h1><p>Review your medication list and refill reminders.</p></div><button class="btn btn-outline" onclick="toast('Prescription download needs a connected medical records backend.')">↓ Download list</button></div><div class="notice">Always follow the directions provided by your licensed clinician. This screen contains illustrative sample data, not medical advice.</div><div class="panel">${panelHead('Current prescriptions','Sample medication records')}<div class="table-wrap"><table><thead><tr><th>Medication</th><th>Prescribed by</th><th>Instructions</th><th>Refills</th><th>Status</th></tr></thead><tbody><tr><td><div class="person-cell"><div class="patient-avatar">♧</div><div><strong>Sample medication A</strong><small>Illustrative entry only</small></div></div></td><td>Dr. Ananya Mehta</td><td>As directed by clinician</td><td>1 remaining</td><td><span class="status active">Active</span></td></tr><tr><td><div class="person-cell"><div class="patient-avatar">♧</div><div><strong>Sample medication B</strong><small>Illustrative entry only</small></div></div></td><td>Dr. Rahul Kapoor</td><td>As directed by clinician</td><td>0 remaining</td><td><span class="status pending">Review</span></td></tr></tbody></table></div></div>`}
function renderBilling(){return `<div class="welcome"><div><h1>Bills & payments</h1><p>Review charges and keep track of your billing status.</p></div><button class="btn btn-outline" onclick="toast('A billing statement can be generated after backend integration.')">↓ Statement</button></div><div class="stats">${stat('Total outstanding','₹850','＄','Sample balance')}${stat('Last payment','₹1,200','✓','Paid Oct 12, 2026')}${stat('Invoices','3','▤','Across recent visits')}${stat('Payment status','Review','◷','Check your latest invoice')}</div><div class="panel">${panelHead('Recent invoices','Illustrative billing data')}<div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody><tr><td>INV-2084</td><td>Outpatient consultation</td><td>Oct 24, 2026</td><td>₹850</td><td><span class="status pending">Due</span></td><td><button class="btn btn-primary btn-sm" onclick="toast('Payment gateway is not connected in this prototype.')">Pay now</button></td></tr><tr><td>INV-2077</td><td>Laboratory services</td><td>Oct 18, 2026</td><td>₹1,200</td><td><span class="status active">Paid</span></td><td><button class="link-btn" onclick="toast('Receipt preview is a demo action.')">Receipt</button></td></tr><tr><td>INV-2061</td><td>Consultation</td><td>Oct 12, 2026</td><td>₹600</td><td><span class="status active">Paid</span></td><td><button class="link-btn" onclick="toast('Receipt preview is a demo action.')">Receipt</button></td></tr></tbody></table></div></div>`}
function renderStaff(){return `<div class="welcome"><div><h1>Staff management</h1><p>Overview of the sample clinical and operations team.</p></div><button class="btn btn-primary" onclick="toast('Staff invitation needs a secure backend.')">＋ Invite staff</button></div><div class="panel">${panelHead('Care team','Sample staff directory')}<div class="table-wrap"><table><thead><tr><th>Staff member</th><th>Department</th><th>Role</th><th>Availability</th><th>Action</th></tr></thead><tbody>${doctors.slice(0,5).map((d,i)=>`<tr><td><div class="person-cell"><div class="patient-avatar">${d.name.split(' ').slice(1).map(x=>x[0]).join('')}</div><div><strong>${d.name}</strong><small>${d.exp}</small></div></div></td><td>${d.dept}</td><td>${i===0?'Senior Consultant':'Consultant'}</td><td><span class="status active">Available</span></td><td><button class="link-btn" onclick="toast('Staff record opened (demo).')">Manage</button></td></tr>`).join('')}</tbody></table></div></div>`}
function renderReports(){return `<div class="welcome"><div><h1>Reports & analytics</h1><p>Operational insights to support better hospital planning.</p></div><button class="btn btn-primary" onclick="toast('Report export is a demo action; connect a reporting API to enable it.')">↓ Export report</button></div><div class="stats">${stat('Appointments this month','1,842','▦','<span class="up">↑ 9.6%</span> month over month')}${stat('Patient satisfaction','94.8%','♡','Sample survey summary')}${stat('Average wait time','18 min','◷','<span class="up">↓ 4 min</span> vs prior month')}${stat('Bed occupancy','76%','▤','Sample occupancy rate')}</div><div class="dashboard-grid"><div class="panel">${panelHead('Weekly activity','Illustrative appointment volume')}${chart()}</div><div class="panel">${panelHead('Operational checklist','Items for administrator review')}<div class="appointment-list"><div class="appointment"><div class="stat-icon">✓</div><div class="appointment-info"><strong>Daily schedule reviewed</strong><span>Operations</span></div><span class="status active">Done</span></div><div class="appointment"><div class="stat-icon">▤</div><div class="appointment-info"><strong>Verify pending reports</strong><span>Laboratory</span></div><span class="status pending">Pending</span></div><div class="appointment"><div class="stat-icon">＄</div><div class="appointment-info"><strong>Review overdue invoices</strong><span>Billing</span></div><span class="status pending">Pending</span></div></div></div></div>`}
function renderSettings(){return `<div class="welcome"><div><h1>${state.role==='admin'?'System settings':'My profile'}</h1><p>${state.role==='admin'?'Manage the demo workspace preferences.':'Manage your personal contact details and preferences.'}</p></div></div><div class="panel" style="max-width:720px">${panelHead('Account information','These changes are local to this browser demo')}<form onsubmit="saveProfile(event)"><div class="field"><label for="profileFullName">Full name</label><input id="profileFullName" value="${state.name.replace(/"/g,'&quot;')}" required></div><div class="field"><label for="profileEmail">Email address</label><input id="profileEmail" type="email" value="${state.email.replace(/"/g,'&quot;')}" required></div><div class="field"><label for="language">Language</label><select id="language"><option>English</option><option>Hindi</option></select></div><div class="field"><label>Notifications</label><label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted)"><input type="checkbox" checked style="accent-color:var(--green)"> Appointment and account updates</label></div><button class="btn btn-primary" type="submit">Save changes</button></form></div><div class="panel" style="max-width:720px;margin-top:18px">${panelHead('Privacy & safety','Important information')}<p style="font-size:12px;color:var(--muted);line-height:1.8">This prototype does not store data on a server, encrypt medical records, or authenticate users. Do not enter real patient information. A production system requires role-based access control, secure sessions, encryption, audit logs, consent workflows, and applicable healthcare privacy compliance.</p></div>`}
function addPatient(){if(state.role!=='admin'){toast('Administrator access required.');return;}const name=prompt('Enter sample patient name:');if(name&&name.trim()){toast('Patient "'+name.trim()+'" added to the demo flow. Connect a backend to persist patient records.');}}
function bookAppointment(doctor=''){if(state.role==='admin'){toast('Use the appointment management flow to schedule a patient (demo).');return;}const specialist=doctor||prompt('Choose a specialty or doctor (e.g., Cardiology):');if(specialist&&specialist.trim()){state.appointments.unshift({name:doctor||'Dr. '+specialist.trim(),dept:doctor?'Appointment request':specialist.trim(),date:'Request submitted · Awaiting confirmation',status:'Pending',type:'New booking'});renderAll();go('appointments');toast('Appointment request added to this demo. It is not yet sent to a hospital.');}}
function filterTable(q){const rows=document.querySelectorAll('#appointmentTable tbody tr, #patientRows tr');rows.forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q.toLowerCase())?'':'none')}
function filterStatus(status){const rows=document.querySelectorAll('#appointmentTable tbody tr');rows.forEach(r=>r.style.display=(status==='all'||r.innerText.toLowerCase().includes(status.toLowerCase()))?'':'none')}
function saveProfile(e){e.preventDefault();state.name=document.getElementById('profileFullName').value.trim();state.email=document.getElementById('profileEmail').value.trim();document.getElementById('profileName').textContent=state.name;document.getElementById('avatarInitials').textContent=state.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();toast('Profile updated in this demo session.');}
function renderAll(){document.getElementById('page-dashboard').innerHTML=state.role==='admin'?adminDashboard():userDashboard();document.getElementById('page-appointments').innerHTML=renderAppointments();document.getElementById('page-doctors').innerHTML=renderDoctors();document.getElementById('page-records').innerHTML=renderRecords();document.getElementById('page-prescriptions').innerHTML=renderPrescriptions();document.getElementById('page-billing').innerHTML=renderBilling();document.getElementById('page-patients').innerHTML=patientDirectory();document.getElementById('page-staff').innerHTML=renderStaff();document.getElementById('page-reports').innerHTML=renderReports();document.getElementById('page-settings').innerHTML=renderSettings();}


// --- CareSphere backend integration (Express + MongoDB) ---
let authMode = 'login';
let apiDoctors = [];
let apiPatients = [];
let accessToken = '';
let accessTokenRefresh = null;
async function refreshAccessToken() {
  if (!accessTokenRefresh) {
    accessTokenRefresh = (async () => {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) {
        accessToken = '';
        throw new Error(data.error || `Token refresh failed (${response.status})`);
      }
      accessToken = data.accessToken;
      return accessToken;
    })().finally(() => { accessTokenRefresh = null; });
  }
  return accessTokenRefresh;
}
async function apiRequest(url, options={}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers||{}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response = await fetch(url, { ...options, credentials: 'same-origin', headers });
  if (response.status === 401 && accessToken && url !== '/api/auth/refresh' && !url.startsWith('/api/auth/login') && !url.startsWith('/api/auth/register')) {
    await refreshAccessToken();
    headers.Authorization = `Bearer ${accessToken}`;
    response = await fetch(url, { ...options, credentials: 'same-origin', headers });
  }
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function showAuthError(message) {
  const el = document.getElementById('loginError');
  if (el) el.textContent = message;
}
async function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const heading = document.querySelector('.auth-heading');
  const sub = document.querySelector('.auth-sub');
  const form = document.getElementById('loginForm');
  const button = form.querySelector('button[type="submit"]');
  const note = document.getElementById('authModeNote');
  let registerFields = document.getElementById('registerFields');
  if (authMode === 'register') {
    if (!registerFields) {
      registerFields = document.createElement('div');
      registerFields.id = 'registerFields';
      registerFields.innerHTML = '<div class="field"><label for="registerName">Full name</label><input id="registerName" type="text" minlength="2" maxlength="80" autocomplete="name" placeholder="Your full name" required></div><div class="field"><label for="registerAge">Age (optional)</label><input id="registerAge" type="number" min="0" max="120" step="1" inputmode="numeric" placeholder="Age in years"></div><div class="field"><label for="registerHospital">Choose your hospital</label><select id="registerHospital" required><option value="">Loading hospitals…</option></select></div>';
      form.insertBefore(registerFields, form.firstElementChild);
    }
    registerFields.classList.remove('hidden');
    document.getElementById('password').minLength = 8;
    document.getElementById('password').autocomplete = 'new-password';
    heading.textContent = 'Create your account';
    sub.textContent = 'Register to save appointments and access your patient dashboard.';
    button.textContent = 'Create account →';
    note.innerHTML = '<span>Already registered?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Sign in</button><br><small>Password must contain at least 8 characters.</small>';
    document.getElementById('roleAdmin').disabled = true;
    setRole('user');
    try {
      const { hospitals } = await apiRequest('/api/hospitals');
      const select = document.getElementById('registerHospital');
      select.innerHTML = '<option value="">Choose a hospital</option>' + hospitals.map(hospital =>
        `<option value="${Number(hospital.id)}">${escapeHtml(hospital.name)}${hospital.city ? ` — ${escapeHtml(hospital.city)}` : ''}</option>`
      ).join('');
      if (!hospitals.length) showAuthError('No hospitals are available yet. Please contact an administrator.');
    } catch (err) {
      document.getElementById('registerHospital').innerHTML = '<option value="">Hospitals could not be loaded</option>';
      showAuthError(err.message);
    }
  } else {
    if (registerFields) registerFields.classList.add('hidden');
    document.getElementById('password').minLength = 8;
    document.getElementById('password').autocomplete = 'current-password';
    heading.textContent = 'Welcome back';
    sub.textContent = 'Sign in to continue to your personalised healthcare workspace.';
    button.textContent = 'Sign in securely →';
    note.innerHTML = '<span>New to CareSphere?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Create an account</button><br><small>Use a test account while developing.</small>';
    document.getElementById('roleAdmin').disabled = false;
  }
  showAuthError('');
}
async function login(e) {
  e.preventDefault();
  showAuthError('');
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const submit = document.querySelector('#loginForm button[type="submit"]');
  submit.disabled = true;
  try {
    let result;
    if (authMode === 'register') {
      const name = document.getElementById('registerName')?.value.trim() || '';
      const age = document.getElementById('registerAge')?.value || null;
      const hospitalId = document.getElementById('registerHospital')?.value || '';
      result = await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, age, hospitalId }) });
    } else {
      result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    }
    if (!result.accessToken) throw new Error('Authentication response did not include an access token.');
    accessToken = result.accessToken;
    state.email = result.user.email;
    state.name = result.user.name;
    state.role = result.user.role === 'admin' ? 'admin' : 'user';
    state.age = result.user.age;
    state.hospital = { id:result.user.hospital_id,name:result.user.hospital_name };
    await enterDashboard();
  } catch (err) {
    showAuthError(err.message || 'Could not sign in. Check the backend terminal and try again.');
  } finally {
    submit.disabled = false;
  }
}
async function enterDashboard() {
  closeAuth();
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('profileName').textContent = state.name;
  document.getElementById('profileRole').textContent = state.role === 'admin' ? 'Administrator' : 'Patient account';
  document.getElementById('avatarInitials').textContent = state.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  try {
    await refreshBackendData();
    buildNav(); renderAll(); go('appointments');
  } catch (err) {
    toast('Connected login, but could not load dashboard data: ' + err.message);
    buildNav(); renderAll(); go('dashboard');
  }
}
async function refreshBackendData() {
  const [appointmentData, doctorData, reportData, prescriptionData, invoiceData, patientData, analyticsData, hospitalData, hospitalListData, adminReportData, womensHealthData] = await Promise.all([
    apiRequest('/api/appointments'),
    apiRequest('/api/doctors'),
    state.role === 'admin' ? Promise.resolve({ reports: [] }) : apiRequest('/api/reports'),
    apiRequest('/api/prescriptions'),
    apiRequest('/api/invoices'),
    state.role === 'admin' ? apiRequest('/api/admin/patients') : Promise.resolve({ patients: [] }),
    state.role === 'admin' ? apiRequest('/api/admin/analytics') : Promise.resolve(null),
    apiRequest('/api/hospital/me'),
    state.role === 'admin' ? apiRequest('/api/admin/hospitals') : Promise.resolve({ hospitals: [] }),
    state.role === 'admin' ? apiRequest('/api/admin/reports') : Promise.resolve({ reports: [] }),
    state.role === 'admin' ? Promise.resolve(null) : apiRequest('/api/womens-health')
  ]);
  state.appointments = appointmentData.appointments.map(a => ({
    id: a.id,
    doctorId: a.doctor_id,
    doctorName: a.doctor_name,
    name: state.role === 'admin' ? (a.patient_name || 'Patient') : a.doctor_name,
    dept: a.specialty,
    date: formatAppointmentDate(a.appointment_at),
    status: a.status,
    type: a.reason || 'Consultation',
    patientEmail: a.patient_email
  }));
  apiDoctors = doctorData.doctors;
  apiPatients = patientData.patients;
  state.reports = reportData.reports;
  state.prescriptions = prescriptionData.prescriptions;
  state.pendingPrescriptions = prescriptionData.pendingPrescriptions || [];
  state.invoices = invoiceData.invoices;
  state.patients = apiPatients;
  state.analytics = analyticsData;
  state.hospital = hospitalData.hospital;
  state.hospitals = hospitalListData.hospitals;
  state.adminReports = adminReportData.reports;
  state.womensHealth = womensHealthData;
  state.womensHealthAnswer = null;
}
window.CareSphereApp = window.CareSphereApp || {};
window.CareSphereApp.refreshBackendData = refreshBackendData;
async function showNotifications() {
  try {
    const result = await apiRequest('/api/notifications');
    if (!result.notifications.length) {
      toast('You have no appointment or billing updates.');
      return;
    }
    toast(result.notifications.map(item => item.message).join(' · '));
  } catch (err) {
    toast(err.message);
  }
}
function formatAppointmentDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
async function logout() {
  try { await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }); }
  catch (err) { console.warn('Sign-out request failed:', err.message); }
  accessToken = '';
  state.appointments = []; state.reports = []; state.adminReports = []; state.prescriptions = []; state.pendingPrescriptions = []; state.invoices = []; state.patients = []; state.analytics = null; state.hospital = null; state.hospitals = []; state.age = null; state.womensHealth = null; state.womensHealthAnswer = null;
  apiDoctors = []; apiPatients = []; state.email = ''; state.name = ''; state.role = 'user';
  document.getElementById('app').classList.add('hidden');
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('sidebar').classList.remove('open');
  state.page = 'dashboard';
}
function renderAppointments() {
  const admin = state.role === 'admin';
  const rows = state.appointments || [];
  return `<div class="welcome"><div><h1>${admin?'Appointment management':'My appointments'}</h1><p>${admin?'Review appointments saved in the database.':'Your appointment requests saved to your CareSphere account.'}</p></div>${admin?'':'<button class="btn btn-primary" onclick="bookAppointment()">＋ Book appointment</button>'}</div><div class="panel"><div class="searchbar"><input placeholder="Search by ${admin?'patient or doctor':'doctor or specialty'}…" oninput="filterTable(this.value)"><select onchange="filterStatus(this.value)"><option value="all">All statuses</option><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option></select></div><div id="appointmentTable">${rows.length ? appointmentsTable(rows,admin) : '<div class="empty-state"><strong>No appointments yet</strong><p>Book an appointment and it will appear here after it is saved.</p></div>'}</div></div>`;
}
function renderDoctors() {
  const admin = state.role === 'admin';
  const list = apiDoctors.length ? apiDoctors : doctors.map((d,i)=>({id:i+1,name:d.name,specialty:d.dept,experience:d.exp,available:1}));
  return `<div class="welcome"><div><h1>${admin?'Doctors & departments':'Find your doctor'}</h1><p>Choose a specialist for your next visit.</p></div></div><div class="searchbar"><input placeholder="Search doctors or specialties…" oninput="filterDoctors(this.value)"><select id="doctorDepartmentFilter" onchange="filterDepartment(this.value)"><option value="all">All specialties</option>${[...new Set(list.map(d=>d.specialty))].map(s=>`<option>${s}</option>`).join('')}</select></div><div id="doctorGrid" class="doctor-card-grid">${backendDoctorCards(list)}</div>`;
}
function backendDoctorCards(items) {
  return items.map(d=>`<article class="doctor-card"><div class="doctor-photo">✚</div><h3>${d.name}</h3><p>${d.specialty}</p><div class="doctor-meta">✧ &nbsp; ${d.experience || 'Care specialist'}</div><button class="btn btn-primary full" style="margin-top:10px" onclick="bookAppointment(${Number(d.id)})">Book appointment →</button></article>`).join('') || '<div class="empty-state">No doctors found.</div>';
}
function filterDoctors(q) {
  const list = apiDoctors.filter(d=>(d.name+' '+d.specialty).toLowerCase().includes(q.toLowerCase()));
  document.getElementById('doctorGrid').innerHTML = backendDoctorCards(list);
}
function filterDepartment(dep) {
  const list = dep==='all' ? apiDoctors : apiDoctors.filter(d=>d.specialty===dep);
  document.getElementById('doctorGrid').innerHTML = backendDoctorCards(list);
}
async function bookAppointment(doctorId=0) {
  if (state.role === 'admin') {
    toast('Appointment requests are created by patient accounts.');
    return;
  }
  const error = document.getElementById('bookingError');
  error.textContent = '';
  try {
    if (!apiDoctors.length) {
      const result = await apiRequest('/api/doctors');
      apiDoctors = result.doctors;
    }
    if (!apiDoctors.length) {
      error.textContent = 'No doctors are currently available. Please try again later.';
      document.getElementById('bookingOverlay').classList.remove('hidden');
      document.getElementById('bookingOverlay').setAttribute('aria-hidden', 'false');
      return;
    }
    const select = document.getElementById('bookingDoctor');
    select.innerHTML = '<option value="">Choose a doctor</option>' + apiDoctors.map(doctor =>
      `<option value="${Number(doctor.id)}">${escapeHtml(doctor.name)} — ${escapeHtml(doctor.specialty)}</option>`
    ).join('');
    if (doctorId) select.value = String(doctorId);
    const now = new Date();
    const minDate = new Date(now.getTime() + 5 * 60 * 1000);
    const defaultDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    defaultDate.setMinutes(0, 0, 0);
    document.getElementById('bookingDate').min = toLocalDateTimeValue(minDate);
    document.getElementById('bookingDate').value = toLocalDateTimeValue(defaultDate);
    document.getElementById('bookingReason').value = 'General consultation';
    document.getElementById('bookingReasonDetails').value = '';
    toggleOtherReason('General consultation');
    document.getElementById('bookingOverlay').classList.remove('hidden');
    document.getElementById('bookingOverlay').setAttribute('aria-hidden', 'false');
    select.focus();
  } catch (err) {
    error.textContent = err.message || 'Could not load doctors. Please try again.';
    document.getElementById('bookingOverlay').classList.remove('hidden');
    document.getElementById('bookingOverlay').setAttribute('aria-hidden', 'false');
  }
}

function toggleOtherReason(reason) {
  const field = document.getElementById('bookingReasonDetailsField');
  const details = document.getElementById('bookingReasonDetails');
  if (!field || !details) return;
  const isOther = reason === 'Other';
  field.classList.toggle('hidden', !isOther);
  details.required = isOther;
}

function toLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function closeBooking() {
  const overlay = document.getElementById('bookingOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.getElementById('bookingError').textContent = '';
  document.getElementById('bookingForm').reset();
}

async function submitAppointment(event) {
  event.preventDefault();
  const form = document.getElementById('bookingForm');
  const submit = document.getElementById('bookingSubmit');
  const error = document.getElementById('bookingError');
  const doctorId = Number(form.elements.doctorId.value);
  const appointmentAt = form.elements.appointmentAt.value;
  const selectedReason = form.elements.reason.value;
  const reasonDetails = document.getElementById('bookingReasonDetails').value.trim();
  const reason = selectedReason === 'Other' ? `Other: ${reasonDetails}` : selectedReason;
  if (selectedReason === 'Other' && !reasonDetails) {
    error.textContent = 'Briefly describe your reason for visiting.';
    return;
  }
  error.textContent = '';
  submit.disabled = true;
  try {
    const result = await apiRequest('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ doctorId, appointmentAt, reason })
    });
    closeBooking();
    try {
      await window.CareSphereApp.refreshBackendData();
    } catch (refreshError) {
      const appointment = result.appointment;
      state.appointments.push({
        id: appointment.id,
        doctorId: appointment.doctor_id,
        name: appointment.doctor_name,
        dept: appointment.specialty,
        date: formatAppointmentDate(appointment.appointment_at),
        status: appointment.status,
        type: appointment.reason || 'Consultation'
      });
      renderAll();
      go('appointments');
      toast(`Appointment saved, but the list could not refresh: ${refreshError.message}`);
      return;
    }
    renderAll();
    go('appointments');
    toast('Appointment saved. You can find it under My appointments.');
  } catch (err) {
    error.textContent = err.message || 'Could not save your appointment. Please try again.';
  } finally {
    submit.disabled = false;
  }
}
async function saveProfile(e) {
  e.preventDefault();
  const submit = document.getElementById('profileSubmit');
  const error = document.getElementById('profileError');
  submit.disabled = true;
  error.textContent = '';
  const name = document.getElementById('profileFullName').value.trim();
  try {
    const ageField = document.getElementById('profileAge');
    const result = await apiRequest('/api/profile',{method:'PATCH',body:JSON.stringify({name, email:document.getElementById('profileEmail').value.trim(),age:ageField?.value ?? null})});
    state.name = result.user.name; state.email = result.user.email;
    state.age = result.user.age;
    document.getElementById('profileName').textContent = state.name;
    document.getElementById('avatarInitials').textContent = state.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    renderAll(); go('settings'); toast('Profile saved.');
  } catch(err) { error.textContent = err.message; }
  finally { submit.disabled = false; }
}
async function restoreSession() {
  try {
    await refreshAccessToken();
    const result = await apiRequest('/api/auth/me');
    if (result.user) {
      state.email = result.user.email; state.name = result.user.name;
      state.role = result.user.role === 'admin' ? 'admin' : 'user';
      state.age = result.user.age;
      state.hospital = { id:result.user.hospital_id,name:result.user.hospital_name };
      await enterDashboard();
    }
  } catch (err) { console.warn('Authentication restore unavailable:', err.message); }
}
// Restore the in-memory access token using the rotating HttpOnly refresh cookie.
restoreSession();


// Keep the overview honest: show database-backed appointment information, not seeded demo visits.
function userDashboard() {
  const count = state.appointments.length;
  const due = state.invoices.filter(invoice => invoice.status === 'Due').length;
  const womensHealthCard = state.womensHealth?.enabled
    ? `<div class="panel" style="margin-top:16px">${panelHead('Your Women’s Health space','Optional mood and cycle tracking, plus source-linked health education')}<button class="btn btn-primary" onclick="go('womens-health')">Open Women’s Health →</button></div>`
    : `<div class="panel" style="margin-top:16px">${panelHead('Optional Women’s Health space','Available if this section is relevant to you; CareSphere does not infer sex or gender from your profile.')}<p>Enable private cycle and mood logs, a small local health-information guide, and educational resources. You can delete this data at any time.</p><button class="btn btn-outline" onclick="enableWomensHealth()">Enable this section</button></div>`;
  return `<div class="welcome"><div><h1>Good day, ${escapeHtml(state.name.split(' ')[0])} 👋</h1><p>Your account information, appointments, and uploaded files are saved in CareSphere.</p></div><div class="welcome-actions"><button class="btn btn-outline" onclick="go('doctors')">Find a doctor</button><button class="btn btn-primary" onclick="bookAppointment()">＋ Book appointment</button></div></div>
  <div class="stats">${stat('Appointments',String(count),'▦','Saved to your account')}${stat('Available doctors',String(apiDoctors.length),'✚','From the doctor directory')}${stat('Health records',String(state.reports.length),'▤','Uploaded documents')}${stat('Due invoices',String(due),'＄','Demo records only')}</div>
  <div class="dashboard-grid"><div class="panel">${panelHead('Your appointments','Requests saved in the CareSphere database')}${count ? appointmentsTable(state.appointments.slice(0,5),false) : '<div class="empty-state"><strong>No appointments yet</strong><p>Choose Find a doctor to request your first appointment.</p></div>'}<button class="btn btn-light" style="margin-top:12px" onclick="go(\'appointments\')">View all appointments →</button></div><div class="panel">${panelHead('Quick links','Open your saved information')}<div class="quick-grid">${quick('▤','Health records',`${state.reports.length} uploaded`, "go('records')")}${quick('♧','Prescriptions',`${state.prescriptions.length} on file`, "go('prescriptions')")}${quick('＄','Bills & payments',`${due} due`, "go('billing')")}${quick('⚙','My profile','Update account details', "go('settings')")}</div></div></div>
  ${womensHealthCard}<div class="notice" style="margin-top:16px">Prescription directions are provided by your care team. Invoice payment status in this prototype is simulated and does not charge money.</div>`;
}

let appointmentSearch = '';
let appointmentStatus = 'all';
let doctorSearch = '';
let doctorDepartment = 'all';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function unavailablePage(title, message, action) {
  return `<div class="welcome"><div><h1>${title}</h1><p>${message}</p></div></div><div class="panel"><div class="empty-state"><strong>This feature is not connected</strong><p>It is unavailable until a backend endpoint and database support are added.</p><button class="btn btn-light" type="button" disabled>${action}</button></div></div>`;
}

function renderAll() {
  document.getElementById('page-dashboard').innerHTML = state.role === 'admin' ? adminDashboard() : userDashboard();
  document.getElementById('page-appointments').innerHTML = renderAppointments();
  document.getElementById('page-doctors').innerHTML = renderDoctors();
  document.getElementById('page-records').innerHTML = renderRecords();
  document.getElementById('page-ai').innerHTML = renderPatientAIHub();
  document.getElementById('page-womens-health').innerHTML = renderWomensHealth();
  document.getElementById('page-prescriptions').innerHTML = renderPrescriptions();
  document.getElementById('page-billing').innerHTML = renderBilling();
  document.getElementById('page-patients').innerHTML = patientDirectory();
  document.getElementById('page-staff').innerHTML = renderStaff();
  document.getElementById('page-reports').innerHTML = renderReports();
  document.getElementById('page-hospitals').innerHTML = renderHospitals();
  document.getElementById('page-settings').innerHTML = renderSettings();
  document.getElementById('page-faq').innerHTML = renderFaq();
}

function adminDashboard() {
  const totals = state.analytics?.totals || {};
  return `<div class="welcome"><div><h1>${escapeHtml(state.hospital?.name || 'Hospital overview')}</h1><p>Live totals for your hospital workspace.</p></div><div class="welcome-actions"><button class="btn btn-outline" onclick="go('hospitals')">Manage hospital</button></div></div>
    <div class="stats">${stat('Patients',String(totals.patients || 0),'♙','Registered patient accounts')}${stat('Appointments',String(totals.appointments || 0),'▦','Saved appointment requests')}${stat('Pending requests',String(totals.pendingAppointments || 0),'◷','Awaiting review')}${stat('Available doctors',String(totals.doctors || 0),'✚','From the doctor directory')}</div>
    <div class="dashboard-grid"><div class="panel">${panelHead('Appointment requests','Update status on the appointments page')}${state.appointments.length ? appointmentsTable(state.appointments.slice(0,5),true) : '<div class="empty-state"><strong>No appointments yet</strong></div>'}<button class="btn btn-light" style="margin-top:12px" onclick="go('appointments')">View all appointments →</button></div><div class="panel">${panelHead('Workspace data','Current database totals')}<p>${totals.uploadedReports || 0} patient-uploaded reports</p><p>${state.prescriptions.length} prescriptions</p><p>${state.invoices.filter(invoice=>invoice.status==='Due').length} invoices due</p><button class="btn btn-light" onclick="go('reports')">Open reports →</button></div></div>
    <div class="panel" style="margin-top:16px">${panelHead('Patient directory','Registered patient accounts')}<p>${apiPatients.length} patient account${apiPatients.length === 1 ? '' : 's'} in the database.</p><button class="btn btn-light" onclick="go('patients')">Open patient directory →</button></div>`;
}

function appointmentsTable(rows, admin=false) {
  return `<div class="table-wrap"><table><thead><tr><th>${admin?'Patient':'Doctor'}</th>${admin?'<th>Doctor</th>':''}<th>${admin?'Department':'Specialty'}</th><th>Date & time</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(appointment => `<tr data-status="${escapeHtml(appointment.status.toLowerCase())}"><td><div class="person-cell"><div class="patient-avatar">${escapeHtml((appointment.name.match(/\b\w/g)||[]).slice(0,2).join(''))}</div><div><strong>${escapeHtml(appointment.name)}</strong><small>${escapeHtml(appointment.type || 'Consultation')}</small></div></div></td>${admin?`<td>${escapeHtml(appointment.doctorName || 'Not assigned')}</td>`:''}<td>${escapeHtml(appointment.dept)}</td><td>${escapeHtml(appointment.date)}</td><td><span class="status ${escapeHtml(appointment.status.toLowerCase())}">${escapeHtml(appointment.status)}</span></td><td>${admin?`<select aria-label="Update appointment status" onchange="updateAppointmentStatus(${Number(appointment.id)},this.value)">${['Pending','Confirmed','Completed','Cancelled'].map(status=>`<option value="${status}" ${status===appointment.status?'selected':''}>${status}</option>`).join('')}</select>`:`<button class="link-btn" onclick="appointmentAction(${Number(appointment.id)},false)">View details</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}

function appointmentAction(id) {
  const appointment = state.appointments.find(item => item.id === Number(id));
  if (!appointment) {
    toast('Appointment is no longer available. Refresh and try again.');
    return;
  }
  toast(`${appointment.name} · ${appointment.date} · ${appointment.status} · ${appointment.type}`);
}

async function updateAppointmentStatus(id,status) {
  try {
    await apiRequest(`/api/appointments/${Number(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    await refreshBackendData();
    renderAll();
    go('appointments');
    toast(`Appointment marked ${status.toLowerCase()}.`);
  } catch (err) {
    try {
      await refreshBackendData();
      renderAll();
      go('appointments');
    } catch (refreshError) {
      toast(`${err.message} The appointment list could not be refreshed: ${refreshError.message}`);
      return;
    }
    toast(err.message);
  }
}

function renderAppointments() {
  const admin = state.role === 'admin';
  const rows = state.appointments || [];
  appointmentSearch = '';
  appointmentStatus = 'all';
  return `<div class="welcome"><div><h1>${admin?'Appointment management':'My appointments'}</h1><p>${admin?'Review and update appointments saved in the database.':'Your appointment requests saved to your CareSphere account.'}</p></div>${admin?'':'<button class="btn btn-primary" onclick="bookAppointment()">＋ Book appointment</button>'}</div><div class="panel"><div class="searchbar"><input placeholder="Search by ${admin?'patient or doctor':'doctor or specialty'}…" oninput="filterTable(this.value)"><select onchange="filterStatus(this.value)"><option value="all">All statuses</option><option>Confirmed</option><option>Pending</option><option>Completed</option><option>Cancelled</option></select></div><div id="appointmentTable">${rows.length ? appointmentsTable(rows,admin) : '<div class="empty-state"><strong>No appointments yet</strong><p>Book an appointment and it will appear here after it is saved.</p></div>'}</div></div>`;
}

function applyAppointmentFilters() {
  document.querySelectorAll('#appointmentTable tbody tr').forEach(row => {
    const matchesText = row.innerText.toLowerCase().includes(appointmentSearch.toLowerCase());
    const matchesStatus = appointmentStatus === 'all' || row.dataset.status === appointmentStatus.toLowerCase();
    row.style.display = matchesText && matchesStatus ? '' : 'none';
  });
  document.querySelectorAll('#patientRows tr').forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(appointmentSearch.toLowerCase()) ? '' : 'none';
  });
}

function filterTable(query) {
  appointmentSearch = query;
  applyAppointmentFilters();
}

function filterStatus(status) {
  appointmentStatus = status;
  applyAppointmentFilters();
}

function renderDoctors() {
  doctorSearch = '';
  doctorDepartment = 'all';
  const specialties = [...new Set(apiDoctors.map(doctor => doctor.specialty))];
  return `<div class="welcome"><div><h1>${state.role==='admin'?'Doctors & departments':'Find your doctor'}</h1><p>${state.role==='admin'?'Manage active doctor availability in Staff management.':'Choose an available specialist for your next visit.'}</p></div>${state.role==='admin'?'<button class="btn btn-primary" onclick="go(\'staff\')">＋ Manage staff</button>':''}</div><div class="searchbar"><input placeholder="Search doctors or specialties…" oninput="filterDoctors(this.value)"><select onchange="filterDepartment(this.value)"><option value="all">All specialties</option>${specialties.map(specialty=>`<option value="${escapeHtml(specialty)}">${escapeHtml(specialty)}</option>`).join('')}</select></div><div id="doctorGrid" class="doctor-card-grid">${backendDoctorCards(apiDoctors)}</div>`;
}

function backendDoctorCards(items) {
  return items.map(doctor=>`<article class="doctor-card"><div class="doctor-photo">✚</div><h3>${escapeHtml(doctor.name)}</h3><p>${escapeHtml(doctor.specialty)}</p><div class="doctor-meta">✧ &nbsp; ${escapeHtml(doctor.experience || 'Care specialist')}</div>${state.role==='admin'?`<div class="doctor-meta">${doctor.available?'Available':'Unavailable'}</div><button class="btn btn-light full" style="margin-top:10px" onclick="toggleDoctorAvailability(${Number(doctor.id)},${doctor.available?0:1})">${doctor.available?'Set unavailable':'Set available'}</button>`:`<button class="btn btn-primary full" style="margin-top:10px" onclick="bookAppointment(${Number(doctor.id)})">Book appointment →</button>`}</article>`).join('') || '<div class="empty-state">No doctors found.</div>';
}

function filterDoctors(query) {
  doctorSearch = query;
  const filtered = apiDoctors.filter(doctor =>
    (doctor.name+' '+doctor.specialty).toLowerCase().includes(doctorSearch.toLowerCase()) &&
    (doctorDepartment === 'all' || doctor.specialty === doctorDepartment) &&
    (state.role === 'admin' || doctor.available)
  );
  document.getElementById('doctorGrid').innerHTML = backendDoctorCards(filtered);
}

function filterDepartment(department) {
  doctorDepartment = department;
  filterDoctors(doctorSearch);
}

function patientDirectory() {
  if (state.role !== 'admin') return '';
  const rows = apiPatients.map(patient => `<tr><td><div class="person-cell"><div class="patient-avatar">${escapeHtml(patient.name.split(/\s+/).map(part=>part[0]).slice(0,2).join(''))}</div><div><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(patient.email)}</small></div></div></td><td>${Number(patient.id)}</td><td>${patient.age==null?'Not provided':`${Number(patient.age)} years`}</td><td>${escapeHtml(patient.created_at)}</td><td><span class="status active">Registered</span></td></tr>`).join('');
  return `<div class="welcome"><div><h1>Patients</h1><p>Patient accounts registered with ${escapeHtml(state.hospital?.name||'this hospital')}.</p></div></div><div class="panel"><div class="searchbar"><input placeholder="Search patient name or email…" oninput="filterTable(this.value)"></div><div class="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Age</th><th>Registered</th><th>Status</th></tr></thead><tbody id="patientRows">${rows}</tbody></table></div>${rows?'':'<div class="empty-state"><strong>No patient accounts yet</strong></div>'}</div>`;
}

function addPatient() {
  openAuth('user');
  toggleAuthMode();
}

function renderRecords() {
  const rows = state.reports.map(report => `<tr><td><strong>${escapeHtml(report.original_name)}</strong><small>${escapeHtml(report.mime_type)}</small></td><td>${formatFileSize(report.file_size)}</td><td>${escapeHtml(formatAppointmentDate(report.created_at))}</td><td><span class="status ${report.shared_with_hospital?'active':'pending'}">${report.shared_with_hospital?'Shared with hospital':'Private'}</span><div class="record-actions"><button class="link-btn" onclick="downloadReport(${Number(report.id)})">Download</button>${report.mime_type==='application/pdf'?`<button class="link-btn" onclick="go('ai')">Report overview & usage</button>`:''}<button class="link-btn" onclick="setReportSharing(${Number(report.id)},${report.shared_with_hospital?0:1})">${report.shared_with_hospital?'Make private':'Share with hospital'}</button><button class="link-btn" onclick="deleteReport(${Number(report.id)})">Delete</button></div></td></tr>`).join('');
  return `<div class="welcome"><div><h1>Health records</h1><p>Upload and manage your medical history for ${escapeHtml(state.hospital?.name || 'your hospital')}.</p></div><button class="btn btn-outline" onclick="go('ai')">Reports & AI usage →</button></div><div class="panel"><h2>Upload a report</h2><form id="reportUploadForm" onsubmit="uploadReport(event)"><div class="field"><label for="reportFile">PDF, JPG, or PNG (maximum 10 MB)</label><input id="reportFile" name="report" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required></div><label class="check-row"><input type="checkbox" name="shareWithHospital" value="true"> Share this file with my hospital care team</label><div class="notice">Sharing is optional. Only shared files appear in your hospital’s administrator workspace; your other files remain private.</div><div id="reportError" class="error" role="alert"></div><button id="reportUploadButton" class="btn btn-primary" type="submit">Upload report</button></form></div><div class="panel" style="margin-top:16px">${panelHead('Your medical history','You control whether each file is shared with your hospital')}${rows?`<div class="table-wrap"><table><thead><tr><th>Report</th><th>Size</th><th>Uploaded</th><th>Privacy and actions</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty-state"><strong>No reports uploaded</strong><p>Choose a file above to add your first report.</p></div>'}</div>`;
}

function renderPatientAIHub() {
  if (state.role !== 'user') return '';
  const summariesUsed = state.reports.reduce((total, report) => total + Number(report.summary_count || 0), 0);
  const rows = state.reports.map(report => `<tr><td><strong>${escapeHtml(report.original_name)}</strong><small>${escapeHtml(report.mime_type)}</small></td><td>${escapeHtml(formatAppointmentDate(report.created_at))}</td><td>${Number(report.summary_count || 0)}</td><td>${report.summary_last_used_at ? escapeHtml(formatAppointmentDate(report.summary_last_used_at)) : 'Not used'}</td><td>${report.mime_type === 'application/pdf' ? `<button class="btn btn-light btn-sm" onclick="summarizeReport(${Number(report.id)})">Create local overview</button>` : '<span>PDF text only</span>'}</td></tr>`).join('');
  const reportList = rows
    ? `<div class="table-wrap"><table><thead><tr><th>Report</th><th>Uploaded</th><th>Overviews created</th><th>Last used</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty-state"><strong>No reports yet</strong><p>Upload a report in Health records to see it here.</p><button class="btn btn-light" onclick="go('records')">Open health records</button></div>`;
  return `<div class="welcome"><div><h1>Reports & AI usage</h1><p>View your uploaded reports and run a private, local text overview.</p></div><button class="btn btn-outline" onclick="go('records')">Upload or manage reports →</button></div><div class="stats">${stat('Your reports',String(state.reports.length),'▤','Only files in your account')}${stat('Local overviews used',String(summariesUsed),'✧','Usage tracked per report')}${stat('External AI requests','0','↗','Your reports are not sent to AI providers')}${stat('AI prescription advice','Off','♧','Medication guidance stays with your clinician')}</div><div class="notice"><strong>Important:</strong> The document overview is a local extractive text helper, not an AI model. It selects text from readable PDFs; it cannot interpret results, read scans, diagnose, or recommend treatment. No report is sent to an external AI service.</div><div class="panel">${panelHead('Your report overview usage','Generate a summary and see when/how often you used it')}${reportList}<div id="reportSummary"></div></div>`;
}

function dateInputToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
}

function renderWomensHealth() {
  if (state.role !== 'user') return '<div class="empty-state">This private section is only available to patient accounts.</div>';
  if (!state.womensHealth?.enabled) {
    return `<div class="welcome"><div><h1>Women’s health</h1><p>An optional private space, available if it is relevant to you.</p></div></div><div class="panel">${panelHead('Enable your private health space','CareSphere does not infer sex or gender from account information.')}<p>Enable to keep mood and period-date logs in your own account and use a local, source-linked health-information guide. You can delete this data later.</p><button class="btn btn-primary" onclick="enableWomensHealth()">Enable Women’s Health</button></div>`;
  }
  const moodRows = state.womensHealth.moodEntries.map(entry => `<tr><td>${escapeHtml(entry.entry_date)}</td><td>${escapeHtml(entry.mood.replace('_',' '))}</td><td>${Number(entry.stress_level)}/5</td><td>${Number(entry.sleep_hours)} hrs</td><td>${Number(entry.energy_level)}/5</td><td>${entry.symptoms.map(escapeHtml).join(', ') || '—'}</td></tr>`).join('');
  const cycleRows = state.womensHealth.cycleEntries.map((entry,index,entries) => {
    const previous = entries[index+1];
    const cycleLength = previous ? Math.round((Date.parse(`${entry.start_date}T00:00:00Z`)-Date.parse(`${previous.start_date}T00:00:00Z`))/86400000) : null;
    return `<tr><td>${escapeHtml(entry.start_date)}</td><td>${entry.end_date ? escapeHtml(entry.end_date) : 'Not entered'}</td><td>${cycleLength ? `${cycleLength} days between logged starts` : '—'}</td></tr>`;
  }).join('');
  const symptomOptions = [
    ['anxiety','Anxiety or worry'],['irritability','Irritability'],['fatigue','Fatigue'],
    ['cramps','Cramps'],['headache','Headache'],['bloating','Bloating'],
    ['acne','Acne'],['irregular_periods','Period changes']
  ];
  const reportOptions = state.womensHealth.reportOptions.map(report => `<label class="health-consent-choice"><input type="checkbox" name="reportIds" value="${Number(report.id)}"> ${escapeHtml(report.original_name)} <small>— only selected text PDFs are processed locally</small></label>`).join('');
  const moodHistory = moodRows
    ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Mood</th><th>Stress</th><th>Sleep</th><th>Energy</th><th>Symptoms</th></tr></thead><tbody>${moodRows}</tbody></table></div>`
    : '<div class="empty-state"><strong>No mood check-ins yet</strong><p>Your entries are private to your patient account.</p></div>';
  const cycleHistory = cycleRows
    ? `<div class="table-wrap"><table><thead><tr><th>Period start</th><th>Period end</th><th>Logged interval</th></tr></thead><tbody>${cycleRows}</tbody></table></div>`
    : '<div class="empty-state"><strong>No dates logged</strong><p>Tracking is optional; there are no predictions or diagnosis from these dates.</p></div>';
  const answer = state.womensHealthAnswer ? `<div class="health-answer"><h3>Local health guide response</h3><p>${escapeHtml(state.womensHealthAnswer.answer).replace(/\n\n/g,'<br><br>')}</p>${state.womensHealthAnswer.moodReflection ? `<p><strong>Mood log reflection:</strong> ${Number(state.womensHealthAnswer.moodReflection.checkInsReviewed)} check-ins reviewed; ${Number(state.womensHealthAnswer.moodReflection.lowerMoodCheckIns)} marked low or very low; average stress ${state.womensHealthAnswer.moodReflection.averageStressLevel ?? 'not available'}/5. ${escapeHtml(state.womensHealthAnswer.moodReflection.message)}</p>` : ''}${state.womensHealthAnswer.reportMatches.length ? `<h4>Text excerpts from reports you selected (not interpreted)</h4><ul>${state.womensHealthAnswer.reportMatches.map(match=>`<li><strong>${escapeHtml(match.reportName)}:</strong> ${escapeHtml(match.excerpt)}</li>`).join('')}</ul>` : ''}${state.womensHealthAnswer.reportsUsed.some(report=>!report.hadSelectableText) ? '<p>At least one selected PDF had no selectable text; scanned pages are not read.</p>' : ''}${state.womensHealthAnswer.sources.length ? `<h4>Retrieved sources</h4><ul>${state.womensHealthAnswer.sources.map(source=>`<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.title)}</a></li>`).join('')}</ul>` : ''}<small>${escapeHtml(state.womensHealthAnswer.notice)}</small></div>` : '';
  return `<div class="welcome"><div><h1>Women’s health</h1><p>Your private cycle and mood notes, plus source-linked health education.</p></div></div>
    <div class="notice"><strong>Important safety note:</strong> This local guide cannot diagnose PCOS/PCOD, interpret or classify medical history, or prescribe meals or treatment. The guide uses keyword retrieval from a small set of health sources; it is not an AI model. Only information you explicitly select is used. Your logs are private to your patient account.</div>
    <div class="stats">${stat('Mood check-ins',String(state.womensHealth.moodEntries.length),'♡','Latest 30 entries')}${stat('Period dates logged',String(state.womensHealth.cycleEntries.length),'▦','Latest 24 entries')}${stat('External AI requests','0','↗','Your data stays in this app')}</div>
    <div class="dashboard-grid">
      <div class="panel">${panelHead('Mood check-in','A reflection tool, not a mental-health assessment')}<form onsubmit="saveWomensMood(event)">
        <div class="field"><label for="whMoodDate">Date</label><input id="whMoodDate" name="entryDate" type="date" max="${dateInputToday()}" value="${dateInputToday()}" required></div>
        <div class="field"><label for="whMood">How have you mostly felt?</label><select id="whMood" name="mood" required><option value="great">Very good</option><option value="good">Good</option><option value="okay" selected>Okay / mixed</option><option value="low">Low</option><option value="very_low">Very low</option></select></div>
        <div class="field"><label for="whStress">Stress level (1 low – 5 high)</label><select id="whStress" name="stressLevel"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
        <div class="field"><label for="whSleep">Sleep last night (hours)</label><input id="whSleep" name="sleepHours" type="number" min="0" max="24" step="0.5" value="8" required></div>
        <div class="field"><label for="whEnergy">Energy (1 low – 5 high)</label><select id="whEnergy" name="energyLevel"><option>1</option><option>2</option><option selected>3</option><option>4</option><option>5</option></select></div>
        <fieldset class="health-symptoms"><legend>Optional symptoms today</legend>${symptomOptions.map(([value,label])=>`<label><input type="checkbox" name="symptoms" value="${value}"> ${label}</label>`).join('')}</fieldset>
        <div id="whMoodError" class="error" role="alert"></div><button class="btn btn-primary" type="submit">Save private check-in</button>
      </form></div>
      <div class="panel">${panelHead('Period-date notes','Optional date tracking; no predictions or diagnostic labels')}<form onsubmit="saveWomensCycle(event)">
        <div class="field"><label for="whCycleStart">Period start date</label><input id="whCycleStart" name="startDate" type="date" max="${dateInputToday()}" required></div>
        <div class="field"><label for="whCycleEnd">Period end date (optional)</label><input id="whCycleEnd" name="endDate" type="date" max="${dateInputToday()}"></div>
        <div id="whCycleError" class="error" role="alert"></div><button class="btn btn-primary" type="submit">Save dates</button>
      </form><p class="muted">Intervals are calculated only between dates you entered; they do not determine whether a cycle is healthy.</p>${cycleHistory}</div>
    </div>
    <div class="panel" style="margin-top:16px">${panelHead('Ask the local health-information guide','Evidence retrieval from a small, cited library; not generative AI')}<form id="womensGuideForm" onsubmit="askWomensHealthGuide(event)">
      <div class="field"><label for="whQuestion">What would you like general information about?</label><textarea id="whQuestion" name="question" maxlength="500" placeholder="For example: What should I ask my clinician about PCOS?" required></textarea></div>
      <label class="health-consent-choice"><input type="checkbox" name="includeMoodHistory"> Include my latest mood check-ins in a simple reflection</label>
      ${reportOptions ? `<fieldset class="health-report-choice"><legend>Select any of your PDF reports to search locally</legend>${reportOptions}</fieldset>` : '<p class="muted">No text PDF reports are available. Uploads are never included unless you explicitly select them here.</p>'}
      <div id="whGuideError" class="error" role="alert"></div><button class="btn btn-primary" type="submit">Get source-linked information</button>
    </form>${answer}</div>
    <div class="dashboard-grid" style="margin-top:16px"><div class="panel">${panelHead('Health facts','General information, not personal predictions')}<ul class="health-facts">${state.womensHealth.funFacts.map(fact=>`<li>${escapeHtml(fact)}</li>`).join('')}</ul></div><div class="panel">${panelHead('Support and safety','Your wellbeing matters')}<p>If you feel unsafe or might harm yourself, contact local emergency services or a trusted person now. If you are in India, call 112 for emergencies or Tele-MANAS at 14416 for mental-health support.</p><p>If mood concerns persist, worsen, or affect daily life, consider talking with a qualified clinician.</p></div></div>
    <div class="panel" style="margin-top:16px">${panelHead('Your control','Your health logs belong to your patient account')}<p>Disabling or deleting removes the mood and cycle logs from this section. Report files are separate and can be managed under Health records.</p><button class="btn btn-outline" onclick="deleteWomensHealthData()">Delete my Women’s Health data and disable</button></div>`;
}

async function enableWomensHealth() {
  try {
    await apiRequest('/api/womens-health/consent',{method:'POST',body:JSON.stringify({enabled:true})});
    await refreshBackendData();
    renderAll(); buildNav(); go('womens-health');
    toast('Your optional Women’s Health section is enabled.');
  } catch (err) {
    toast(err.message);
  }
}

async function saveWomensMood(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById('whMoodError');
  error.textContent = '';
  const symptoms = [...form.querySelectorAll('input[name="symptoms"]:checked')].map(input=>input.value);
  try {
    await apiRequest('/api/womens-health/mood',{method:'POST',body:JSON.stringify({
      entryDate:form.elements.entryDate.value,
      mood:form.elements.mood.value,
      stressLevel:Number(form.elements.stressLevel.value),
      sleepHours:Number(form.elements.sleepHours.value),
      energyLevel:Number(form.elements.energyLevel.value),
      symptoms
    })});
    await refreshBackendData();
    renderAll(); go('womens-health');
    toast('Private mood check-in saved.');
  } catch (err) {
    error.textContent = err.message;
  }
}

async function saveWomensCycle(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById('whCycleError');
  error.textContent = '';
  try {
    await apiRequest('/api/womens-health/cycle',{method:'POST',body:JSON.stringify({
      startDate:form.elements.startDate.value,
      endDate:form.elements.endDate.value || null
    })});
    await refreshBackendData();
    renderAll(); go('womens-health');
    toast('Private period dates saved.');
  } catch (err) {
    error.textContent = err.message;
  }
}

async function askWomensHealthGuide(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const error = document.getElementById('whGuideError');
  error.textContent = '';
  const reportIds = [...form.querySelectorAll('input[name="reportIds"]:checked')].map(input=>Number(input.value));
  try {
    state.womensHealthAnswer = await apiRequest('/api/womens-health/guide',{method:'POST',body:JSON.stringify({
      question:form.elements.question.value,
      includeMoodHistory:form.elements.includeMoodHistory.checked,
      includeReports:reportIds.length > 0,
      reportIds
    })});
    renderAll(); go('womens-health');
  } catch (err) {
    error.textContent = err.message;
  }
}

async function deleteWomensHealthData() {
  if (!window.confirm('Delete all Women’s Health mood and period-date logs and disable this section? This cannot be undone.')) return;
  try {
    await apiRequest('/api/womens-health/data',{method:'DELETE'});
    await refreshBackendData();
    renderAll(); buildNav(); go('dashboard');
    toast('Women’s Health logs deleted and section disabled.');
  } catch (err) {
    toast(err.message);
  }
}

function renderPrescriptions() {
  const rows = state.prescriptions.map(prescription => `<tr>${state.role==='admin'?`<td>${escapeHtml(prescription.patient_name)}</td>`:''}<td>${escapeHtml(prescription.medication)}</td><td>${escapeHtml(prescription.doctor_name || 'Care team')}</td><td>${escapeHtml(prescription.directions)}</td><td>${Number(prescription.refills)}</td><td><span class="status ${prescription.status.toLowerCase()}">${escapeHtml(prescription.status)}</span></td>${state.role==='admin'?`<td><button class="link-btn" onclick="editPrescription(${Number(prescription.id)})">Edit</button></td>`:''}</tr>`).join('');
  const pendingRows = state.role === 'admin' ? state.pendingPrescriptions.map(prescription => `<tr><td>${escapeHtml(prescription.patient_name)}<small>${escapeHtml(prescription.patient_email)}</small></td><td>${escapeHtml(prescription.medication)}</td><td>${escapeHtml(prescription.doctor_name || 'Care team')}</td><td>${escapeHtml(prescription.directions)}</td><td>${Number(prescription.refills)}</td><td><span class="status pending">Awaiting registration</span></td><td>—</td></tr>`).join('') : '';
  const createForm = state.role === 'admin' ? `<div class="panel" style="margin-bottom:16px"><h2 id="prescriptionFormTitle">Add prescription record</h2><form id="prescriptionForm" onsubmit="createPrescription(event)"><input type="hidden" name="id" value=""><div class="field"><label for="prescriptionPatientType">Patient type</label><select id="prescriptionPatientType" name="patientType" onchange="setPrescriptionPatientType(this.value)"><option value="registered">Existing registered patient</option><option value="new">New patient (not registered yet)</option></select></div><div class="field" id="registeredPatientField"><label for="prescriptionPatient">Patient</label><select id="prescriptionPatient" name="userId" required><option value="">Choose a patient</option>${state.patients.map(patient=>`<option value="${Number(patient.id)}">${escapeHtml(patient.name)} — ${escapeHtml(patient.email)}</option>`).join('')}</select></div><div id="newPrescriptionPatientFields" class="hidden"><div class="field"><label for="newPrescriptionPatientName">Patient name</label><input id="newPrescriptionPatientName" name="patientName" maxlength="80" disabled></div><div class="field"><label for="newPrescriptionPatientEmail">Patient email</label><input id="newPrescriptionPatientEmail" name="patientEmail" type="email" maxlength="254" disabled></div><p class="muted">This record will be linked to the patient’s account if they register at this hospital with this email address.</p></div><div class="field"><label for="prescriptionDoctor">Clinician</label><select id="prescriptionDoctor" name="doctorId"><option value="">Not specified</option>${apiDoctors.map(doctor=>`<option value="${Number(doctor.id)}">${escapeHtml(doctor.name)}</option>`).join('')}</select></div><div class="field"><label for="prescriptionMedication">Prescription name</label><input id="prescriptionMedication" name="medication" maxlength="120" required></div><div class="field"><label for="prescriptionDirections">Directions as provided by clinician</label><textarea id="prescriptionDirections" name="directions" maxlength="500" required></textarea></div><div class="field"><label for="prescriptionRefills">Refills</label><input id="prescriptionRefills" name="refills" type="number" min="0" max="20" value="0" required></div><div class="field hidden" id="prescriptionStatusField"><label for="prescriptionStatus">Status</label><select id="prescriptionStatus" name="status"><option>Active</option><option>Completed</option><option>Stopped</option></select></div><div id="prescriptionError" class="error" role="alert"></div><button class="btn btn-primary" id="prescriptionSubmit" type="submit">Save prescription</button><button class="btn btn-outline hidden" id="prescriptionCancel" type="button" onclick="cancelPrescriptionEdit()">Cancel edit</button></form></div>` : '';
  const patientHeading = state.role === 'admin' ? '<th>Patient</th>' : '';
  const emptyMessage = state.role === 'admin' ? 'Use the form above to add a record.' : 'Your care team has not added any prescription records.';
  const table = rows || pendingRows
    ? `<div class="table-wrap"><table><thead><tr>${patientHeading}<th>Prescription</th><th>Clinician</th><th>Directions</th><th>Refills</th><th>Status</th>${state.role==='admin'?'<th>Action</th>':''}</tr></thead><tbody>${rows}${pendingRows}</tbody></table></div>`
    : `<div class="empty-state"><strong>No prescriptions on file</strong><p>${emptyMessage}</p></div>`;
  return `<div class="welcome"><div><h1>Prescriptions</h1><p>${state.role==='admin'?'Add and review prescription records for patients at your active hospital.':'Review prescription information added by your hospital care team.'}</p></div><button class="btn btn-outline" onclick="exportPrescriptions()">↓ Download list</button></div>${createForm}<div class="panel">${panelHead('Prescription records',state.role==='admin'?'Saved by your hospital and visible only to the selected patient.':'Records shared with your account by your hospital')}${table}</div><div class="notice" style="margin-top:16px">For record-keeping only. Prescription entries come from the hospital care team. AI does not choose, interpret, or change medication or doses. Ask your clinician or pharmacist if you have questions; do not change medication based on this prototype.</div>`;
}

function renderBilling() {
  const paymentMethods = [
    ['pay-at-hospital','Pay at hospital (demo)'],
    ['upi-demo','UPI (demo; no transaction)'],
    ['card-demo','Card (demo; no card details)']
  ];
  const paymentMethodLabels = Object.fromEntries(paymentMethods);
  const rows = state.invoices.map(invoice => {
    const payment = invoice.payment_method ? `<small>Demo method: ${escapeHtml(paymentMethodLabels[invoice.payment_method] || invoice.payment_method)}</small>` : '';
    const action = state.role === 'admin' ? '—' : invoice.status === 'Due'
      ? `<label class="payment-choice" for="paymentMethod-${Number(invoice.id)}">Payment choice</label><select id="paymentMethod-${Number(invoice.id)}">${paymentMethods.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select><button class="btn btn-primary btn-sm" style="margin-top:8px" onclick="payInvoiceDemo(${Number(invoice.id)})">Record demo payment</button>`
      : 'Paid';
    return `<tr>${state.role==='admin'?`<td>${escapeHtml(invoice.patient_name)}<small>${escapeHtml(invoice.patient_email)}</small></td>`:''}<td>${escapeHtml(invoice.description)}</td><td>${(Number(invoice.amount_cents)/100).toLocaleString(undefined,{style:'currency',currency:'INR'})}</td><td><span class="status ${invoice.status==='Paid'?'completed':'pending'}">${escapeHtml(invoice.status)}</span>${invoice.payment_method ? `<br>${payment}` : ''}</td><td>${action}</td></tr>`;
  }).join('');
  const createForm = state.role === 'admin' ? `<div class="panel" style="margin-bottom:16px"><h2>Create invoice record</h2><form id="invoiceForm" onsubmit="createInvoice(event)"><div class="field"><label for="invoicePatient">Patient</label><select id="invoicePatient" name="userId" required><option value="">Choose a patient</option>${state.patients.map(patient=>`<option value="${Number(patient.id)}">${escapeHtml(patient.name)} — ${escapeHtml(patient.email)}</option>`).join('')}</select></div><div class="field"><label for="invoiceDescription">Description</label><input id="invoiceDescription" name="description" maxlength="160" required></div><div class="field"><label for="invoiceAmount">Amount (INR)</label><input id="invoiceAmount" name="amount" type="number" min="0.01" max="1000000" step="0.01" required></div><div id="invoiceError" class="error" role="alert"></div><button class="btn btn-primary" type="submit">Save invoice</button></form></div>` : '';
  const patientHeading = state.role === 'admin' ? '<th>Patient</th>' : '';
  const actionHeading = state.role === 'admin' ? 'Action' : 'Payment option';
  const emptyMessage = state.role === 'admin' ? 'Create an invoice using the form above.' : 'No invoice records are linked to your account.';
  const table = rows
    ? `<div class="table-wrap"><table><thead><tr>${patientHeading}<th>Description</th><th>Amount</th><th>Status</th><th>${actionHeading}</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="empty-state"><strong>No invoices</strong><p>${emptyMessage}</p></div>`;
  return `<div class="welcome"><div><h1>${state.role==='admin'?'Billing records':'Bills & payments'}</h1><p>${state.role==='admin'?'Create and review invoice records.':'View your invoices and choose a demo payment option.'}</p></div></div>${createForm}<div class="panel">${panelHead('Invoices','Amounts and statuses stored in the local database')}${table}</div><div class="notice" style="margin-top:16px">Demonstration only: these choices do not charge money, contact a bank, or connect to a payment provider. Do not enter card, UPI, or banking details.</div>`;
}

function renderStaff() {
  if (state.role !== 'admin') return unavailablePage('Staff management','Administrator access is required.','Unavailable');
  const rows = apiDoctors.map(doctor=>`<tr><td>${escapeHtml(doctor.name)}</td><td>${escapeHtml(doctor.specialty)}</td><td>${escapeHtml(doctor.experience || 'Not specified')}</td><td><span class="status ${doctor.available?'active':'pending'}">${doctor.available?'Available':'Unavailable'}</span></td><td><button class="btn btn-light btn-sm" onclick="toggleDoctorAvailability(${Number(doctor.id)},${doctor.available?0:1})">${doctor.available?'Set unavailable':'Set available'}</button></td></tr>`).join('');
  return `<div class="welcome"><div><h1>Staff management</h1><p>Add doctors for ${escapeHtml(state.hospital?.name||'your hospital')} and control their patient-facing availability.</p></div></div><div class="panel" style="margin-bottom:16px"><h2>Add a doctor</h2><form id="doctorForm" onsubmit="createDoctor(event)"><div class="field"><label for="doctorName">Doctor name</label><input id="doctorName" name="name" minlength="3" maxlength="100" required></div><div class="field"><label for="doctorSpecialty">Specialty / department</label><input id="doctorSpecialty" name="specialty" minlength="2" maxlength="80" required></div><div class="field"><label for="doctorExperience">Experience (optional)</label><input id="doctorExperience" name="experience" maxlength="80"></div><div id="doctorError" class="error" role="alert"></div><button class="btn btn-primary" type="submit">Add doctor</button></form></div><div class="panel">${panelHead('Clinical staff','Only doctors assigned to this hospital are listed')}${rows?`<div class="table-wrap"><table><thead><tr><th>Name</th><th>Department</th><th>Experience</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="empty-state">No doctors are registered for this hospital.</div>'}</div>`;
}

function renderReports() {
  if (state.role !== 'admin') return unavailablePage('Reports & analytics','Administrator access is required.','Unavailable');
  const totals = state.analytics?.totals || {};
  const rows = state.analytics?.recentAppointments || [];
  const sharedReports = state.adminReports.map(report=>`<tr><td>${escapeHtml(report.patient_name)}<small>${escapeHtml(report.patient_email)}</small></td><td>${escapeHtml(report.original_name)}<small>${escapeHtml(report.mime_type)} · ${formatFileSize(report.file_size)}</small></td><td>${escapeHtml(formatAppointmentDate(report.created_at))}</td><td><button class="link-btn" onclick="downloadReport(${Number(report.id)})">Download shared report</button></td></tr>`).join('');
  return `<div class="welcome"><div><h1>Reports & analytics</h1><p>Live operational totals for ${escapeHtml(state.hospital?.name || 'your hospital')}.</p></div><button class="btn btn-primary" onclick="exportOperationalReport()">↓ Export CSV</button></div><div class="stats">${stat('Patients',String(totals.patients||0),'♙','Registered accounts')}${stat('Appointments',String(totals.appointments||0),'▦','All requests')}${stat('Due invoices',String(totals.dueInvoices||0),'＄','Awaiting demo payment')}${stat('Shared medical reports',String(totals.uploadedReports||0),'▤','Shared by patients')}</div><div class="panel">${panelHead('Recent appointments','Most recent 100 records')}${rows.length?appointmentsTable(rows.map(appointment=>({id:appointment.id,name:appointment.patient_name,doctorName:appointment.doctor_name,dept:appointment.specialty,date:formatAppointmentDate(appointment.appointment_at),status:appointment.status,type:appointment.reason})),true):'<div class="empty-state">No appointment data to report.</div>'}</div><div class="panel" style="margin-top:16px">${panelHead('Patient-shared medical history','Patients control access; only files explicitly shared with this hospital appear here')}${sharedReports?`<div class="table-wrap"><table><thead><tr><th>Patient</th><th>Report</th><th>Uploaded</th><th>Access</th></tr></thead><tbody>${sharedReports}</tbody></table></div>`:'<div class="empty-state"><strong>No shared reports</strong><p>Patient-shared medical history will appear here.</p></div>'}</div>`;
}

function renderSettings() {
  return `<div class="welcome"><div><h1>${state.role==='admin'?'Account settings':'My profile'}</h1><p>Update your account information in the CareSphere database.</p></div></div><div class="panel" style="max-width:720px">${panelHead('Account information','Changes are saved to your account')}<form onsubmit="saveProfile(event)"><div class="field"><label for="profileFullName">Full name</label><input id="profileFullName" type="text" minlength="2" maxlength="80" value="${escapeHtml(state.name)}" required></div><div class="field"><label for="profileEmail">Email address</label><input id="profileEmail" type="email" maxlength="254" value="${escapeHtml(state.email)}" required></div>${state.role==='admin'?'':`<div class="field"><label for="profileAge">Age in years (optional)</label><input id="profileAge" type="number" min="0" max="120" step="1" value="${state.age ?? ''}" placeholder="Enter your age"></div><div class="field"><label>Selected hospital</label><input value="${escapeHtml(state.hospital?.name || '')}" readonly></div>`}<div id="profileError" class="error" role="alert"></div><button id="profileSubmit" class="btn btn-primary" type="submit">Save profile</button></form></div>`;
}

function renderHospitals() {
  if(state.role!=='admin')return '';
  const hospitals=state.hospitals.map(hospital=>`<option value="${Number(hospital.id)}" ${hospital.id===state.hospital?.id?'selected':''}>${escapeHtml(hospital.name)}${hospital.city?` — ${escapeHtml(hospital.city)}`:''}</option>`).join('');
  return `<div class="welcome"><div><h1>Hospital administration</h1><p>Manage your assigned hospital workspace. Staff, patients, and appointments are isolated by hospital.</p></div></div><div class="panel" style="max-width:760px;margin-bottom:16px">${panelHead('Your hospital workspaces','You can only open hospitals assigned to your admin account')}<div class="field"><label for="hospitalWorkspace">Active hospital</label><select id="hospitalWorkspace" onchange="selectHospital(this.value)">${hospitals}</select></div><form id="hospitalProfileForm" onsubmit="saveHospital(event)"><div class="field"><label for="hospitalName">Hospital name</label><input id="hospitalName" name="name" maxlength="120" value="${escapeHtml(state.hospital?.name||'')}" required></div><div class="field"><label for="hospitalCity">City</label><input id="hospitalCity" name="city" maxlength="100" value="${escapeHtml(state.hospital?.city||'')}"></div><div class="field"><label for="hospitalPhone">Contact phone</label><input id="hospitalPhone" name="phone" maxlength="40" value="${escapeHtml(state.hospital?.phone||'')}"></div><div id="hospitalError" class="error" role="alert"></div><button class="btn btn-primary" type="submit">Save hospital details</button></form></div><div class="panel" style="max-width:760px">${panelHead('Add a hospital','New hospitals are assigned only to your administrator account')}<form id="newHospitalForm" onsubmit="createHospital(event)"><div class="field"><label for="newHospitalName">Hospital name</label><input id="newHospitalName" name="name" maxlength="120" required></div><div class="field"><label for="newHospitalCity">City</label><input id="newHospitalCity" name="city" maxlength="100"></div><div id="newHospitalError" class="error" role="alert"></div><button class="btn btn-outline" type="submit">＋ Add hospital</button></form></div>`;
}

function renderFaq() {
  const entries=[
    ['How do I choose a hospital?','Choose the hospital during patient registration. Its available doctors and care team will be used for your appointments. Hospital changes after registration are not available in this prototype.'],
    ['How do I book an appointment?','Open Find a doctor, choose an available doctor at your selected hospital, select a future date and time, and submit your request. The hospital administrator can update its status.'],
    ['Who can see my medical history files?','Your files are private by default. A hospital administrator can access a file only after you choose “Share with hospital.” You can make it private or delete it later.'],
    ['Does the local PDF summary use AI or send my file online?','No. The helper extracts selectable text on this server and chooses a few representative sentences. Files are not sent to an AI provider. Scanned PDFs and images are not read.'],
    ['Can the report helper diagnose a condition?','No. The extracted text may be incomplete or misleading. It is not a diagnosis or treatment advice; review the original document with your licensed clinician.'],
    ['How do I update my age?','Open My profile and enter your age in years. Age is optional and can be changed or cleared there.'],
    ['Can administrators see all hospitals?','No. Administrators can access only hospital workspaces assigned to their account. Patient accounts, doctors, and appointment records are scoped to one hospital at a time.']
  ];
  return `<div class="welcome"><div><h1>Frequently asked questions</h1><p>Help for patient and hospital administrator workspaces.</p></div></div><div class="panel faq-list">${entries.map(([question,answer])=>`<details><summary>${escapeHtml(question)}</summary><p>${escapeHtml(answer)}</p></details>`).join('')}</div>`;
}

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

async function selectHospital(hospitalId) {
  try {
    await apiRequest('/api/admin/hospitals/select',{method:'POST',body:JSON.stringify({hospitalId:Number(hospitalId)})});
    await refreshBackendData();
    renderAll();
    go('hospitals');
    toast(`Switched to ${state.hospital.name}.`);
  } catch(err) {
    toast(err.message);
    await refreshBackendData();
    renderAll();
    go('hospitals');
  }
}

async function createHospital(event) {
  event.preventDefault();
  const form=document.getElementById('newHospitalForm');
  const error=document.getElementById('newHospitalError');
  error.textContent='';
  try {
    await apiRequest('/api/admin/hospitals',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    await refreshBackendData();
    renderAll();
    go('hospitals');
    toast('Hospital workspace created and assigned to your admin account.');
  } catch(err) { error.textContent=err.message; }
}

async function saveHospital(event) {
  event.preventDefault();
  const error=document.getElementById('hospitalError');
  error.textContent='';
  try {
    const form=document.getElementById('hospitalProfileForm');
    await apiRequest('/api/admin/hospital',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    await refreshBackendData();
    renderAll();
    go('hospitals');
    toast('Hospital details saved.');
  } catch(err) { error.textContent=err.message; }
}

async function uploadReport(event) {
  event.preventDefault();
  const form = document.getElementById('reportUploadForm');
  const button = document.getElementById('reportUploadButton');
  const error = document.getElementById('reportError');
  error.textContent = '';
  button.disabled = true;
  try {
    const response = await fetch('/api/reports', {
      method: 'POST',
      credentials: 'same-origin',
      body: new FormData(form)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Upload failed (${response.status}).`);
    await refreshBackendData();
    renderAll();
    go('ai');
    toast('Report uploaded. Open Reports & AI and click “Create local overview” when you’re ready.');
  } catch (err) {
    error.textContent = err.message || 'Could not upload the report.';
  } finally {
    button.disabled = false;
  }
}

function downloadReport(id) {
  window.location.assign(`/api/reports/${Number(id)}/download`);
}

async function setReportSharing(id,shared) {
  try {
    await apiRequest(`/api/reports/${Number(id)}/share`,{method:'PATCH',body:JSON.stringify({shared:Boolean(shared)})});
    await refreshBackendData();
    renderAll();
    go('records');
    toast(shared?'Report shared with your hospital.':'Report is now private.');
  } catch(err) { toast(err.message); }
}

async function summarizeReport(id) {
  const resultPanel=document.getElementById('reportSummary');
  if (!resultPanel) {
    toast('Open Reports & AI before creating a report overview.');
    return;
  }
  resultPanel.innerHTML='<div class="notice">Extracting selectable PDF text locally…</div>';
  try {
    const result=await apiRequest(`/api/reports/${Number(id)}/summary`,{method:'POST',body:'{}'});
    await refreshBackendData();
    renderAll();
    go('ai');
    const updatedPanel=document.getElementById('reportSummary');
    if (!updatedPanel) throw new Error('The overview was created, but the result panel could not be displayed. Reopen Reports & AI.');
    updatedPanel.innerHTML=`<div class="notice report-summary" role="status"><strong>Local document overview</strong><ul>${result.summary.map(sentence=>`<li>${escapeHtml(sentence)}</li>`).join('')}</ul><p>${escapeHtml(result.notice)} Read ${Number(result.pagesRead)} of ${Number(result.totalPages)} pages. Overview usage for this report: ${Number(result.usageCount)}. No file was sent to an external AI service.</p></div>`;
  } catch(err) {
    const currentPanel=document.getElementById('reportSummary');
    if(currentPanel) currentPanel.innerHTML=`<div class="notice" role="alert">${escapeHtml(err.message)}</div>`;
    else toast(err.message || 'Could not display the report overview.');
  }
}

async function deleteReport(id) {
  try {
    await apiRequest(`/api/reports/${Number(id)}`, { method: 'DELETE' });
    await refreshBackendData();
    renderAll();
    go('records');
    toast('Report deleted.');
  } catch (err) {
    toast(err.message);
  }
}

async function createDoctor(event) {
  event.preventDefault();
  const form = document.getElementById('doctorForm');
  const error = document.getElementById('doctorError');
  error.textContent = '';
  try {
    await apiRequest('/api/admin/doctors', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    await refreshBackendData();
    renderAll();
    go('staff');
    toast('Doctor added to the directory.');
  } catch (err) {
    error.textContent = err.message;
  }
}

async function toggleDoctorAvailability(id,available) {
  try {
    await apiRequest(`/api/admin/doctors/${Number(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ available: Boolean(available) })
    });
    await refreshBackendData();
    renderAll();
    go(state.page);
    toast(`Doctor marked ${available?'available':'unavailable'}.`);
  } catch (err) {
    toast(err.message);
  }
}

async function createPrescription(event) {
  event.preventDefault();
  const form = document.getElementById('prescriptionForm');
  const error = document.getElementById('prescriptionError');
  error.textContent = '';
  try {
    const data = Object.fromEntries(new FormData(form));
    const id = Number(data.id);
    delete data.id;
    await apiRequest(id ? `/api/admin/prescriptions/${id}` : '/api/admin/prescriptions', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(data)
    });
    await refreshBackendData();
    renderAll();
    go('prescriptions');
    toast(id ? 'Prescription record updated for the patient.' : 'Prescription record saved.');
  } catch (err) {
    error.textContent = err.message;
  }
}

function editPrescription(id) {
  const prescription = state.prescriptions.find(item => item.id === Number(id));
  const form = document.getElementById('prescriptionForm');
  if (!prescription || !form) {
    toast('Prescription record is no longer available. Refresh and try again.');
    return;
  }
  form.elements.id.value = String(prescription.id);
  form.elements.patientType.value = 'registered';
  setPrescriptionPatientType('registered');
  form.elements.userId.value = String(prescription.user_id);
  form.elements.userId.disabled = true;
  form.elements.doctorId.value = prescription.doctor_id == null ? '' : String(prescription.doctor_id);
  form.elements.medication.value = prescription.medication;
  form.elements.directions.value = prescription.directions;
  form.elements.refills.value = String(prescription.refills);
  form.elements.status.value = prescription.status;
  document.getElementById('prescriptionFormTitle').textContent = `Update prescription for ${prescription.patient_name}`;
  document.getElementById('prescriptionStatusField').classList.remove('hidden');
  document.getElementById('prescriptionSubmit').textContent = 'Save updates';
  document.getElementById('prescriptionCancel').classList.remove('hidden');
  document.getElementById('prescriptionError').textContent = '';
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelPrescriptionEdit() {
  const form = document.getElementById('prescriptionForm');
  if (!form) return;
  form.reset();
  form.elements.id.value = '';
  setPrescriptionPatientType(form.elements.patientType.value);
  form.elements.userId.disabled = false;
  document.getElementById('prescriptionFormTitle').textContent = 'Add prescription record';
  document.getElementById('prescriptionStatusField').classList.add('hidden');
  document.getElementById('prescriptionSubmit').textContent = 'Save prescription';
  document.getElementById('prescriptionCancel').classList.add('hidden');
  document.getElementById('prescriptionError').textContent = '';
}

function setPrescriptionPatientType(type) {
  const registered = type === 'registered';
  const patientField = document.getElementById('registeredPatientField');
  const newPatientFields = document.getElementById('newPrescriptionPatientFields');
  const patientSelect = document.getElementById('prescriptionPatient');
  const patientName = document.getElementById('newPrescriptionPatientName');
  const patientEmail = document.getElementById('newPrescriptionPatientEmail');
  if (!patientField || !newPatientFields || !patientSelect || !patientName || !patientEmail) return;
  patientField.classList.toggle('hidden', !registered);
  newPatientFields.classList.toggle('hidden', registered);
  patientSelect.disabled = !registered;
  patientSelect.required = registered;
  patientName.disabled = registered;
  patientName.required = !registered;
  patientEmail.disabled = registered;
  patientEmail.required = !registered;
}

async function createInvoice(event) {
  event.preventDefault();
  const form = document.getElementById('invoiceForm');
  const error = document.getElementById('invoiceError');
  error.textContent = '';
  try {
    const data = Object.fromEntries(new FormData(form));
    data.amountCents = Math.round(Number(data.amount) * 100);
    delete data.amount;
    await apiRequest('/api/admin/invoices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    await refreshBackendData();
    renderAll();
    go('billing');
    toast('Invoice record saved.');
  } catch (err) {
    error.textContent = err.message;
  }
}

async function payInvoiceDemo(id) {
  try {
    const paymentMethod = document.getElementById(`paymentMethod-${Number(id)}`)?.value || '';
    await apiRequest(`/api/invoices/${Number(id)}/pay-demo`, { method: 'POST', body: JSON.stringify({ paymentMethod }) });
    await refreshBackendData();
    renderAll();
    go('billing');
    toast('Demo payment choice saved. No money was charged.');
  } catch (err) {
    toast(err.message);
  }
}

function downloadCsv(filename, rows) {
  const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportPrescriptions() {
  downloadCsv('caresphere-prescriptions.csv', [
    [ ...(state.role==='admin'?['Patient']:[]), 'Prescription','Clinician','Directions','Refills','Status','Created' ],
    ...state.prescriptions.map(item => [
      ...(state.role==='admin'?[item.patient_name]:[]),
      item.medication,item.doctor_name,item.directions,item.refills,item.status,item.created_at
    ])
  ]);
}

function exportOperationalReport() {
  const totals = state.analytics?.totals || {};
  const appointments = state.analytics?.recentAppointments || [];
  downloadCsv('caresphere-operational-report.csv', [
    ['Metric','Value'],
    ...Object.entries(totals),
    [],
    ['Patient','Email','Doctor','Specialty','Appointment','Status','Reason'],
    ...appointments.map(item => [item.patient_name,item.patient_email,item.doctor_name,item.specialty,item.appointment_at,item.status,item.reason])
  ]);
}
