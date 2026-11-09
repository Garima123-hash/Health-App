const state={role:'user',page:'dashboard',name:'Vedant Sharma',email:'',appointments:[],search:''};
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
const userNav=[['dashboard','⌂','Overview'],['appointments','▦','My appointments'],['doctors','✚','Find a doctor'],['records','▤','Health records'],['prescriptions','♧','Prescriptions'],['billing','＄','Bills & payments'],['settings','⚙','My profile']];
const adminNav=[['dashboard','⌂','Overview'],['appointments','▦','Appointments'],['patients','♙','Patients'],['doctors','✚','Doctors & departments'],['staff','♧','Staff management'],['reports','▥','Reports & analytics'],['settings','⚙','System settings']];
function openAuth(role='user'){setRole(role);document.getElementById('authOverlay').classList.remove('hidden');document.getElementById('loginError').textContent='';}
function closeAuth(){document.getElementById('authOverlay').classList.add('hidden')}
function setRole(role){state.role=role;document.getElementById('roleUser').classList.toggle('active',role==='user');document.getElementById('roleAdmin').classList.toggle('active',role==='admin');document.getElementById('loginError').textContent='';}
function login(e){e.preventDefault();const email=document.getElementById('email').value.trim();const pass=document.getElementById('password').value;if(!email||pass.length<4){document.getElementById('loginError').textContent='Please enter a valid email and a password with at least 4 characters.';return;}state.email=email;state.name=state.role==='admin'?'Hospital Administrator':(email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase())||'Patient');closeAuth();document.getElementById('landing').classList.add('hidden');document.getElementById('app').classList.remove('hidden');document.getElementById('profileName').textContent=state.name;document.getElementById('profileRole').textContent=state.role==='admin'?'Administrator':'Patient account';document.getElementById('avatarInitials').textContent=state.role==='admin'?'AD':state.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();buildNav();renderAll();go('dashboard');}
function logout(){document.getElementById('app').classList.add('hidden');document.getElementById('landing').classList.remove('hidden');document.getElementById('sidebar').classList.remove('open');state.page='dashboard';}
function buildNav(){const nav=state.role==='admin'?adminNav:userNav;document.getElementById('navItems').innerHTML=nav.map(([id,ico,label])=>`<button class="nav-item ${state.page===id?'active':''}" onclick="go('${id}')"><span class="nav-ico">${ico}</span>${label}</button>`).join('');}
function go(page){state.page=page;document.querySelectorAll('.page-section').forEach(x=>x.classList.remove('active'));const section=document.getElementById('page-'+page);if(section)section.classList.add('active');document.getElementById('topPage').textContent=({dashboard:'Overview',appointments:state.role==='admin'?'Appointments':'My appointments',doctors:state.role==='admin'?'Doctors & departments':'Find a doctor',records:'Health records',prescriptions:'Prescriptions',billing:'Bills & payments',patients:'Patients',staff:'Staff management',reports:'Reports & analytics',settings:state.role==='admin'?'System settings':'My profile'})[page]||'Overview';buildNav();document.getElementById('sidebar').classList.remove('open');}
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


// --- CareSphere backend integration (Express + SQLite) ---
let authMode = 'login';
let apiDoctors = [];
let apiPatients = [];
async function apiRequest(url, options={}) {
  const response = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers||{}) }, ...options });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
function showAuthError(message) {
  const el = document.getElementById('loginError');
  if (el) el.textContent = message;
}
function toggleAuthMode() {
  authMode = authMode === 'login' ? 'register' : 'login';
  const heading = document.querySelector('.auth-heading');
  const sub = document.querySelector('.auth-sub');
  const form = document.getElementById('loginForm');
  const button = form.querySelector('button[type="submit"]');
  const note = document.getElementById('authModeNote');
  let nameField = document.getElementById('registerNameField');
  if (authMode === 'register') {
    if (!nameField) {
      nameField = document.createElement('div');
      nameField.id = 'registerNameField';
      nameField.className = 'field';
      nameField.innerHTML = '<label for="registerName">Full name</label><input id="registerName" type="text" minlength="2" maxlength="80" autocomplete="name" placeholder="Your full name" required>';
      form.insertBefore(nameField, form.firstElementChild);
    }
    nameField.classList.remove('hidden');
    document.getElementById('password').minLength = 8;
    document.getElementById('password').autocomplete = 'new-password';
    heading.textContent = 'Create your account';
    sub.textContent = 'Register to save appointments and access your patient dashboard.';
    button.textContent = 'Create account →';
    note.innerHTML = '<span>Already registered?</span> <button type="button" class="link-btn" onclick="toggleAuthMode()">Sign in</button><br><small>Password must contain at least 8 characters.</small>';
    document.getElementById('roleAdmin').disabled = true;
    setRole('user');
  } else {
    if (nameField) nameField.classList.add('hidden');
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
      result = await apiRequest('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    } else {
      result = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    }
    state.email = result.user.email;
    state.name = result.user.name;
    state.role = result.user.role === 'admin' ? 'admin' : 'user';
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
  async function refreshBackendData() {
    const requests = [
      apiRequest('/api/appointments'),
      apiRequest('/api/doctors'),
      state.role === 'admin' ? apiRequest('/api/admin/patients') : Promise.resolve({ patients: [] })
    ];
    const [appointmentData, doctorData, patientData] = await Promise.all(requests);
    state.appointments = appointmentData.appointments.map(a => ({
      id: a.id,
      doctorId: a.doctor_id,
      name: state.role === 'admin' ? (a.patient_name || 'Patient') : a.doctor_name,
      dept: a.specialty,
      date: formatAppointmentDate(a.appointment_at),
      status: a.status,
      type: a.reason || 'Consultation',
      patientEmail: a.patient_email
    }));
    apiDoctors = doctorData.doctors;
    apiPatients = patientData.patients;
  }
}
function formatAppointmentDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}
async function logout() {
  try { await apiRequest('/api/auth/logout', { method: 'POST', body: '{}' }); }
  catch (err) { console.warn('Sign-out request failed:', err.message); }
  state.appointments = []; state.email = ''; state.name = ''; state.role = 'user';
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
    document.getElementById('bookingReason').value = 'Consultation';
    document.getElementById('bookingOverlay').classList.remove('hidden');
    document.getElementById('bookingOverlay').setAttribute('aria-hidden', 'false');
    select.focus();
  } catch (err) {
    error.textContent = err.message || 'Could not load doctors. Please try again.';
    document.getElementById('bookingOverlay').classList.remove('hidden');
    document.getElementById('bookingOverlay').setAttribute('aria-hidden', 'false');
  }
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
  const reason = form.elements.reason.value.trim() || 'Consultation';
  error.textContent = '';
  submit.disabled = true;
  try {
    const result = await apiRequest('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ doctorId, appointmentAt, reason })
    });
    closeBooking();
    try {
      await refreshBackendData();
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
    toast('Appointment request saved to the database.');
  } catch (err) {
    error.textContent = err.message || 'Could not save your appointment. Please try again.';
  } finally {
    submit.disabled = false;
  }
}
async function saveProfile(e) {
  e.preventDefault();
  const name = document.getElementById('profileFullName').value.trim();
  try {
    const result = await apiRequest('/api/profile',{method:'PATCH',body:JSON.stringify({name, email:document.getElementById('profileEmail').value.trim()})});
    state.name = result.user.name; state.email = result.user.email;
    document.getElementById('profileName').textContent = state.name;
    document.getElementById('avatarInitials').textContent = state.name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    renderAll(); toast('Profile name saved.');
  } catch(err) { toast(err.message); }
}
async function restoreSession() {
  try {
    const result = await apiRequest('/api/auth/me');
    if (result.user) {
      state.email = result.user.email; state.name = result.user.name;
      state.role = result.user.role === 'admin' ? 'admin' : 'user';
      await enterDashboard();
    }
  } catch (err) { console.warn('Session restore unavailable:', err.message); }
}
// Ask the backend whether an existing session should be restored after refresh.
restoreSession();


// Keep the overview honest: show database-backed appointment information, not seeded demo visits.
function userDashboard() {
  const count = state.appointments.length;
  return `<div class="welcome"><div><h1>Good day, ${escapeHtml(state.name.split(' ')[0])} 👋</h1><p>Your CareSphere account overview.</p></div><div class="welcome-actions"><button class="btn btn-outline" onclick="go('doctors')">Find a doctor</button><button class="btn btn-primary" onclick="bookAppointment()">＋ Book appointment</button></div></div>
  <div class="stats">${stat('Saved appointments',String(count),'▦','Stored in your account')}${stat('Available doctors',String(apiDoctors.length),'✚','From the database')}${stat('Health records','Not connected','▤','Backend integration pending')}${stat('Prescriptions','Not connected','♧','Backend integration pending')}</div>
  <div class="panel">${panelHead('Your appointments','Information loaded from the CareSphere database')}${count ? appointmentsTable(state.appointments.slice(0,5),false) : '<div class="empty-state"><strong>No appointments yet</strong><p>Choose Find a doctor to create your first appointment request.</p></div>'}<button class="btn btn-light" style="margin-top:12px" onclick="go(\'appointments\')">View all appointments →</button></div>
  <div class="notice" style="margin-top:16px">Health records, prescriptions, billing, and notifications are not yet connected to a real database in this prototype.</div>`;
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
  document.getElementById('page-prescriptions').innerHTML = renderPrescriptions();
  document.getElementById('page-billing').innerHTML = renderBilling();
  document.getElementById('page-patients').innerHTML = patientDirectory();
  document.getElementById('page-staff').innerHTML = renderStaff();
  document.getElementById('page-reports').innerHTML = renderReports();
  document.getElementById('page-settings').innerHTML = renderSettings();
}

function adminDashboard() {
  const pending = state.appointments.filter(appointment => appointment.status === 'Pending').length;
  return `<div class="welcome"><div><h1>Hospital overview</h1><p>Live totals from the CareSphere database.</p></div></div>
    <div class="stats">${stat('Patients',String(apiPatients.length),'♙','Registered patient accounts')}${stat('Appointments',String(state.appointments.length),'▦','Saved appointment requests')}${stat('Pending requests',String(pending),'◷','Awaiting review')}${stat('Available doctors',String(apiDoctors.length),'✚','From the doctor directory')}</div>
    <div class="panel">${panelHead('Appointments','Manage status for saved appointment requests')}${state.appointments.length ? appointmentsTable(state.appointments.slice(0,5),true) : '<div class="empty-state"><strong>No appointments yet</strong></div>'}<button class="btn btn-light" style="margin-top:12px" onclick="go('appointments')">View all appointments →</button></div>
    <div class="panel" style="margin-top:16px">${panelHead('Patient directory','Registered patient accounts')}<p>${apiPatients.length} patient account${apiPatients.length === 1 ? '' : 's'} in the database.</p><button class="btn btn-light" onclick="go('patients')">Open patient directory →</button></div>`;
}

function appointmentsTable(rows, admin=false) {
  return `<div class="table-wrap"><table><thead><tr><th>${admin?'Patient':'Doctor'}</th><th>${admin?'Department / clinician':'Specialty'}</th><th>Date & time</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map(appointment => `<tr data-status="${escapeHtml(appointment.status.toLowerCase())}"><td><div class="person-cell"><div class="patient-avatar">${escapeHtml((appointment.name.match(/\b\w/g)||[]).slice(0,2).join(''))}</div><div><strong>${escapeHtml(appointment.name)}</strong><small>${escapeHtml(appointment.type || 'Consultation')}</small></div></div></td><td>${escapeHtml(appointment.dept)}</td><td>${escapeHtml(appointment.date)}</td><td><span class="status ${escapeHtml(appointment.status.toLowerCase())}">${escapeHtml(appointment.status)}</span></td><td><button class="link-btn" onclick="${admin?`appointmentAction(${Number(appointment.id)})`:`appointmentAction(${Number(appointment.id)},false)`}">${admin?'Update status':'View details'}</button></td></tr>`).join('')}</tbody></table></div>`;
}

async function appointmentAction(id, admin=state.role === 'admin') {
  const appointment = state.appointments.find(item => item.id === Number(id));
  if (!appointment) {
    toast('Appointment is no longer available. Refresh and try again.');
    return;
  }
  if (!admin) {
    toast(`${appointment.name} · ${appointment.date} · ${appointment.status}`);
    return;
  }
  const status = prompt(`Current status: ${appointment.status}\nEnter Pending, Confirmed, Completed, or Cancelled:`, appointment.status);
  if (status === null) return;
  const normalizedStatus = ['Pending','Confirmed','Completed','Cancelled'].find(value => value.toLowerCase() === status.trim().toLowerCase());
  if (!normalizedStatus) {
    toast('Choose Pending, Confirmed, Completed, or Cancelled.');
    return;
  }
  try {
    await apiRequest(`/api/appointments/${Number(id)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: normalizedStatus })
    });
    await refreshBackendData();
    renderAll();
    go('appointments');
    toast('Appointment status saved.');
  } catch (err) {
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
  return `<div class="welcome"><div><h1>${state.role==='admin'?'Doctors & departments':'Find your doctor'}</h1><p>${state.role==='admin'?'Doctor listings from the database.':'Choose a specialist for your next visit.'}</p></div></div><div class="searchbar"><input placeholder="Search doctors or specialties…" oninput="filterDoctors(this.value)"><select onchange="filterDepartment(this.value)"><option value="all">All specialties</option>${specialties.map(specialty=>`<option value="${escapeHtml(specialty)}">${escapeHtml(specialty)}</option>`).join('')}</select></div><div id="doctorGrid" class="doctor-card-grid">${backendDoctorCards(apiDoctors)}</div>`;
}

function backendDoctorCards(items) {
  return items.map(doctor=>`<article class="doctor-card"><div class="doctor-photo">✚</div><h3>${escapeHtml(doctor.name)}</h3><p>${escapeHtml(doctor.specialty)}</p><div class="doctor-meta">✧ &nbsp; ${escapeHtml(doctor.experience || 'Care specialist')}</div>${state.role==='admin'?'<button class="btn btn-light full" type="button" disabled title="Doctor management is not connected">Management unavailable</button>':`<button class="btn btn-primary full" style="margin-top:10px" onclick="bookAppointment(${Number(doctor.id)})">Book appointment →</button>`}</article>`).join('') || '<div class="empty-state">No doctors found.</div>';
}

function filterDoctors(query) {
  doctorSearch = query;
  const filtered = apiDoctors.filter(doctor =>
    (doctor.name+' '+doctor.specialty).toLowerCase().includes(doctorSearch.toLowerCase()) &&
    (doctorDepartment === 'all' || doctor.specialty === doctorDepartment)
  );
  document.getElementById('doctorGrid').innerHTML = backendDoctorCards(filtered);
}

function filterDepartment(department) {
  doctorDepartment = department;
  filterDoctors(doctorSearch);
}

function patientDirectory() {
  if (state.role !== 'admin') return '';
  const rows = apiPatients.map(patient => `<tr><td><div class="person-cell"><div class="patient-avatar">${escapeHtml(patient.name.split(/\s+/).map(part=>part[0]).slice(0,2).join(''))}</div><div><strong>${escapeHtml(patient.name)}</strong><small>${escapeHtml(patient.email)}</small></div></div></td><td>${Number(patient.id)}</td><td>${escapeHtml(patient.created_at)}</td><td><span class="status active">Registered</span></td></tr>`).join('');
  return `<div class="panel"><div class="searchbar"><input placeholder="Search patient name or email…" oninput="filterTable(this.value)"></div><div class="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Registered</th><th>Status</th></tr></thead><tbody id="patientRows">${rows}</tbody></table></div>${rows?'':'<div class="empty-state"><strong>No patient accounts yet</strong></div>'}</div>`;
}

function addPatient() {
  toast('Patient creation is unavailable because the backend does not provide a patient-registration endpoint.');
}

function renderRecords() {
  return unavailablePage('Health records','View or upload medical records. No records backend is available yet.','Upload document');
}

function renderPrescriptions() {
  return unavailablePage('Prescriptions','Prescription data is not available from the backend yet.','Download list');
}

function renderBilling() {
  return unavailablePage('Bills & payments','Billing and payment services are not connected.','Pay now');
}

function renderStaff() {
  return unavailablePage('Staff management','Staff onboarding and management are not connected.','Invite staff');
}

function renderReports() {
  return unavailablePage('Reports & analytics','Reporting data and exports are not connected.','Export report');
}

function renderSettings() {
  if (state.role === 'admin') return unavailablePage('System settings','Administrator settings are not connected to the backend.','Save settings');
  return `<div class="welcome"><div><h1>My profile</h1><p>Update your account information in the CareSphere database.</p></div></div><div class="panel" style="max-width:720px">${panelHead('Account information','Changes are saved to your account')}<form onsubmit="saveProfile(event)"><div class="field"><label for="profileFullName">Full name</label><input id="profileFullName" type="text" minlength="2" maxlength="80" value="${escapeHtml(state.name)}" required></div><div class="field"><label for="profileEmail">Email address</label><input id="profileEmail" type="email" maxlength="254" value="${escapeHtml(state.email)}" required></div><button class="btn btn-primary" type="submit">Save profile</button></form></div>`;
}
