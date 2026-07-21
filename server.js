const express=require("express"),session=require("express-session"),bcrypt=require("bcryptjs"),Database=require("better-sqlite3"),path=require("path"),fs=require("fs"),multer=require("multer"),PDFDocument=require("pdfkit");
const app=express(),db=new Database(process.env.DB_PATH||"college.db"),PORT=process.env.PORT||3000;
app.disable("x-powered-by");
app.use((req,res,next)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","SAMEORIGIN");res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");next()});
app.use(express.json());app.use(express.urlencoded({extended:true}));
const uploadDir=path.join(__dirname,"uploads"); if(!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir,{recursive:true});
const storage=multer.diskStorage({destination:(req,file,cb)=>cb(null,uploadDir),filename:(req,file,cb)=>{const safe=Date.now()+"-"+file.originalname.replace(/[^a-zA-Z0-9._-]/g,"_");cb(null,safe)}});
const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(req,file,cb)=>{const ok=/^image\/(jpeg|png)|application\/pdf$/.test(file.mimetype);cb(ok?null:new Error("Only PDF, JPG and PNG files are allowed"),ok)}});
app.use("/uploads",express.static(uploadDir));
app.use(express.static(path.join(__dirname,"public")));
app.use(session({secret:process.env.SESSION_SECRET||"change-this-secret",resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:"lax",secure:process.env.COOKIE_SECURE==="true"}}));

db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,student_id INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS students(id INTEGER PRIMARY KEY AUTOINCREMENT,enrollment_no TEXT UNIQUE,name TEXT NOT NULL,email TEXT,mobile TEXT,city TEXT,program TEXT,qualification TEXT,admission_status TEXT DEFAULT 'Active',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS enquiries(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,mobile TEXT NOT NULL,email TEXT,city TEXT,program TEXT NOT NULL,student_type TEXT,message TEXT,status TEXT DEFAULT 'New',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS admissions(id INTEGER PRIMARY KEY AUTOINCREMENT,application_no TEXT UNIQUE NOT NULL,name TEXT NOT NULL,mobile TEXT NOT NULL,email TEXT,city TEXT,program TEXT NOT NULL,qualification TEXT,status TEXT DEFAULT 'Submitted',created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notices(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS attendance(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,date TEXT NOT NULL,status TEXT NOT NULL,marked_by INTEGER);
CREATE TABLE IF NOT EXISTS results(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,subject TEXT NOT NULL,marks REAL NOT NULL,max_marks REAL DEFAULT 100,semester TEXT);
CREATE TABLE IF NOT EXISTS assignments(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT,program TEXT,due_date TEXT,created_by INTEGER,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS fees(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,amount REAL NOT NULL,description TEXT,paid_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS timetable(id INTEGER PRIMARY KEY AUTOINCREMENT,program TEXT NOT NULL,day TEXT NOT NULL,time TEXT NOT NULL,subject TEXT NOT NULL,faculty TEXT);
CREATE TABLE IF NOT EXISTS documents(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,doc_type TEXT NOT NULL,file_name TEXT NOT NULL,file_path TEXT NOT NULL,uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payment_orders(id INTEGER PRIMARY KEY AUTOINCREMENT,student_id INTEGER NOT NULL,amount REAL NOT NULL,order_ref TEXT UNIQUE NOT NULL,status TEXT DEFAULT 'Pending',created_at TEXT DEFAULT CURRENT_TIMESTAMP,paid_at TEXT);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT DEFAULT 'info',is_read INTEGER DEFAULT 0,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
if(db.prepare("SELECT COUNT(*) c FROM users").get().c===0){
 const ins=db.prepare("INSERT INTO users(name,email,password_hash,role,student_id) VALUES(?,?,?,?,?)");
 ins.run("College Admin","admin@shubhamshuklacollege.in",bcrypt.hashSync("Admin@123",10),"admin",null);
 ins.run("Demo Faculty","faculty@college.local",bcrypt.hashSync("Faculty@123",10),"faculty",null);
 const st=db.prepare("INSERT INTO students(enrollment_no,name,email,mobile,city,program,qualification) VALUES(?,?,?,?,?,?,?)").run("SSC2026001","Demo Student","student@college.local","9999999999","Rewa","MBA in HR","Graduate");
 ins.run("Demo Student","student@college.local",bcrypt.hashSync("Student@123",10),"student",st.lastInsertRowid);
}
function auth(req,res,next){if(!req.session.user)return res.status(401).json({error:"Login required"});next()}
function role(...roles){return(req,res,next)=>roles.includes(req.session.user?.role)?next():res.status(403).json({error:"Access denied"})}
app.get("/api/session",(req,res)=>res.json({user:req.session.user||null}));
app.post("/api/login",(req,res)=>{const u=db.prepare("SELECT * FROM users WHERE email=?").get(req.body.email);if(!u||!bcrypt.compareSync(req.body.password,u.password_hash))return res.status(401).json({error:"Invalid credentials"});req.session.user={id:u.id,name:u.name,email:u.email,role:u.role,student_id:u.student_id};res.json({user:req.session.user})});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.post("/api/enquiries",(req,res)=>{let {name,mobile,email="",city="",program,student_type="",message=""}=req.body;if(!name||!mobile||!program)return res.status(400).json({error:"Required fields missing"});let r=db.prepare("INSERT INTO enquiries(name,mobile,email,city,program,student_type,message) VALUES(?,?,?,?,?,?,?)").run(name,mobile,email,city,program,student_type,message);res.json({ok:true,id:r.lastInsertRowid})});
app.post("/api/admissions",(req,res)=>{let {name,mobile,email="",city="",program,qualification=""}=req.body;if(!name||!mobile||!program)return res.status(400).json({error:"Required fields missing"});let no="SSC-"+Date.now().toString().slice(-8);db.prepare("INSERT INTO admissions(application_no,name,mobile,email,city,program,qualification) VALUES(?,?,?,?,?,?,?)").run(no,name,mobile,email,city,program,qualification);res.json({ok:true,application_no:no})});

app.get("/api/admin/summary",auth,role("admin"),(req,res)=>res.json({enquiries:db.prepare("SELECT COUNT(*) c FROM enquiries").get().c,admissions:db.prepare("SELECT COUNT(*) c FROM admissions").get().c,students:db.prepare("SELECT COUNT(*) c FROM students").get().c,faculty:db.prepare("SELECT COUNT(*) c FROM users WHERE role='faculty'").get().c,fees:db.prepare("SELECT COALESCE(SUM(amount),0) c FROM fees").get().c}));
app.get("/api/admin/enquiries",auth,role("admin"),(req,res)=>res.json(db.prepare("SELECT * FROM enquiries ORDER BY id DESC").all()));
app.patch("/api/admin/enquiries/:id",auth,role("admin"),(req,res)=>{db.prepare("UPDATE enquiries SET status=? WHERE id=?").run(req.body.status,req.params.id);res.json({ok:true})});
app.get("/api/admin/admissions",auth,role("admin"),(req,res)=>res.json(db.prepare("SELECT * FROM admissions ORDER BY id DESC").all()));
app.get("/api/admin/students",auth,role("admin"),(req,res)=>res.json(db.prepare("SELECT * FROM students ORDER BY id DESC").all()));
app.post("/api/admin/students",auth,role("admin"),(req,res)=>{let {name,email,mobile,city,program,qualification}=req.body;let no="SSC"+new Date().getFullYear()+String(Date.now()).slice(-5);let r=db.prepare("INSERT INTO students(enrollment_no,name,email,mobile,city,program,qualification) VALUES(?,?,?,?,?,?,?)").run(no,name,email,mobile,city,program,qualification);res.json({ok:true,enrollment_no:no,id:r.lastInsertRowid})});
app.post("/api/admin/convert/:id",auth,role("admin"),(req,res)=>{let a=db.prepare("SELECT * FROM admissions WHERE id=?").get(req.params.id);if(!a)return res.status(404).json({error:"Not found"});let no="SSC"+new Date().getFullYear()+String(Date.now()).slice(-5);let r=db.prepare("INSERT INTO students(enrollment_no,name,email,mobile,city,program,qualification) VALUES(?,?,?,?,?,?,?)").run(no,a.name,a.email,a.mobile,a.city,a.program,a.qualification);db.prepare("UPDATE admissions SET status='Approved & Enrolled' WHERE id=?").run(a.id);
const tempPassword="Welcome@"+no.slice(-4);
const user=db.prepare("INSERT OR IGNORE INTO users(name,email,password_hash,role,student_id) VALUES(?,?,?,?,?)").run(a.name,a.email||("student"+r.lastInsertRowid+"@college.local"),bcrypt.hashSync(tempPassword,10),"student",r.lastInsertRowid);
notifyUser(user.lastInsertRowid,"Admission Approved","Your admission has been approved. Enrollment: "+no+" | Temporary password: "+tempPassword,"success");
res.json({ok:true,enrollment_no:no,student_id:r.lastInsertRowid,temp_password:tempPassword})});

app.get("/api/notices",auth,(req,res)=>res.json(db.prepare("SELECT * FROM notices ORDER BY id DESC").all()));
app.post("/api/notices",auth,role("admin","faculty"),(req,res)=>{db.prepare("INSERT INTO notices(title,body) VALUES(?,?)").run(req.body.title,req.body.body);res.json({ok:true})});
app.get("/api/student/profile",auth,role("student"),(req,res)=>res.json(db.prepare("SELECT * FROM students WHERE id=?").get(req.session.user.student_id)));
app.get("/api/student/attendance",auth,role("student"),(req,res)=>res.json(db.prepare("SELECT * FROM attendance WHERE student_id=? ORDER BY date DESC").all(req.session.user.student_id)));
app.get("/api/student/results",auth,role("student"),(req,res)=>res.json(db.prepare("SELECT * FROM results WHERE student_id=? ORDER BY id DESC").all(req.session.user.student_id)));
app.get("/api/student/fees",auth,role("student"),(req,res)=>res.json(db.prepare("SELECT * FROM fees WHERE student_id=? ORDER BY id DESC").all(req.session.user.student_id)));
app.get("/api/assignments",auth,(req,res)=>res.json(db.prepare("SELECT * FROM assignments ORDER BY id DESC").all()));
app.post("/api/assignments",auth,role("admin","faculty"),(req,res)=>{db.prepare("INSERT INTO assignments(title,description,program,due_date,created_by) VALUES(?,?,?,?,?)").run(req.body.title,req.body.description,req.body.program,req.body.due_date,req.session.user.id);res.json({ok:true})});
app.get("/api/admin/attendance",auth,role("admin","faculty"),(req,res)=>res.json(db.prepare("SELECT a.*,s.name,s.enrollment_no FROM attendance a JOIN students s ON s.id=a.student_id ORDER BY a.date DESC").all()));
app.post("/api/attendance",auth,role("admin","faculty"),(req,res)=>{db.prepare("INSERT INTO attendance(student_id,date,status,marked_by) VALUES(?,?,?,?)").run(req.body.student_id,req.body.date,req.body.status,req.session.user.id);res.json({ok:true})});
app.post("/api/results",auth,role("admin","faculty"),(req,res)=>{db.prepare("INSERT INTO results(student_id,subject,marks,max_marks,semester) VALUES(?,?,?,?,?)").run(req.body.student_id,req.body.subject,req.body.marks,req.body.max_marks||100,req.body.semester||"");res.json({ok:true})});
app.post("/api/fees",auth,role("admin"),(req,res)=>{db.prepare("INSERT INTO fees(student_id,amount,description) VALUES(?,?,?)").run(req.body.student_id,req.body.amount,req.body.description||"Fee Payment");res.json({ok:true})});

// Version 4: documents, fee receipts, payment-ready workflow and notifications
app.get("/api/student/documents",auth,role("student"),(req,res)=>res.json(db.prepare("SELECT * FROM documents WHERE student_id=? ORDER BY id DESC").all(req.session.user.student_id)));
app.post("/api/student/documents",auth,role("student"),upload.single("document"),(req,res)=>{
  if(!req.file||!req.body.doc_type)return res.status(400).json({error:"Document and document type are required"});
  const r=db.prepare("INSERT INTO documents(student_id,doc_type,file_name,file_path) VALUES(?,?,?,?)").run(req.session.user.student_id,req.body.doc_type,req.file.originalname,"/uploads/"+req.file.filename);
  res.json({ok:true,id:r.lastInsertRowid});
});
app.get("/api/admin/documents",auth,role("admin"),(req,res)=>res.json(db.prepare("SELECT d.*,s.name,s.enrollment_no FROM documents d JOIN students s ON s.id=d.student_id ORDER BY d.id DESC").all()));

app.post("/api/student/payment-order",auth,role("student"),(req,res)=>{
  const amount=Number(req.body.amount); if(!amount||amount<=0)return res.status(400).json({error:"Valid amount required"});
  const ref="SSC-PAY-"+Date.now().toString().slice(-10);
  db.prepare("INSERT INTO payment_orders(student_id,amount,order_ref) VALUES(?,?,?)").run(req.session.user.student_id,amount,ref);
  res.json({ok:true,order_ref:ref,status:"Pending",message:"Payment gateway integration point created"});
});
app.get("/api/student/payment-orders",auth,role("student"),(req,res)=>res.json(db.prepare("SELECT * FROM payment_orders WHERE student_id=? ORDER BY id DESC").all(req.session.user.student_id)));
app.post("/api/admin/payment-orders/:id/mark-paid",auth,role("admin"),(req,res)=>{db.prepare("UPDATE payment_orders SET status='Paid',paid_at=CURRENT_TIMESTAMP WHERE id=?").run(req.params.id);res.json({ok:true})});
app.get("/api/admin/payment-orders",auth,role("admin"),(req,res)=>res.json(db.prepare("SELECT p.*,s.name,s.enrollment_no FROM payment_orders p JOIN students s ON s.id=p.student_id ORDER BY p.id DESC").all()));

app.get("/api/student/receipt/:id",auth,role("student"),(req,res)=>{
  const p=db.prepare("SELECT p.*,s.name,s.enrollment_no,s.program FROM payment_orders p JOIN students s ON s.id=p.student_id WHERE p.id=? AND p.student_id=?").get(req.params.id,req.session.user.student_id);
  if(!p)return res.status(404).send("Receipt not found");
  const doc=new PDFDocument({margin:50}); res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename=${p.order_ref}.pdf`);doc.pipe(res);
  doc.fontSize(22).text("SHUBHAM SHUKLA COLLEGE",{align:"center"}).moveDown();
  doc.fontSize(16).text("FEE PAYMENT RECEIPT",{align:"center"}).moveDown(2);
  doc.fontSize(12).text(`Receipt Reference: ${p.order_ref}`).moveDown(.5).text(`Student: ${p.name}`).text(`Enrollment: ${p.enrollment_no}`).text(`Program: ${p.program}`).text(`Amount: INR ${p.amount}`).text(`Status: ${p.status}`).text(`Payment Date: ${p.paid_at||"Pending"}`).moveDown(2);
  doc.text("This is a system-generated receipt.").end();
});

app.get("/api/notifications",auth,(req,res)=>res.json(db.prepare("SELECT * FROM notifications WHERE user_id=? OR user_id IS NULL ORDER BY id DESC").all(req.session.user.id)));
app.patch("/api/notifications/:id/read",auth,(req,res)=>{db.prepare("UPDATE notifications SET is_read=1 WHERE id=? AND (user_id=? OR user_id IS NULL)").run(req.params.id,req.session.user.id);res.json({ok:true})});
function notifyUser(userId,title,message,type="info"){db.prepare("INSERT INTO notifications(user_id,title,message,type) VALUES(?,?,?,?)").run(userId,title,message,type)}

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log("Portal running at http://localhost:"+PORT));