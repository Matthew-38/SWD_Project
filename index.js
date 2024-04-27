var express = require("express");
var passport = require('passport');
var session = require('express-session');
var cookieParser = require('cookie-parser');
//var csrf = require('csurf');
var SQLiteStore = require('connect-sqlite3')(session);
var sqlite3 = require('sqlite3').verbose();
var LocalStrategy = require('passport-local');
var crypto = require('node:crypto');
var ensureLoggedIn = require('connect-ensure-login').ensureLoggedIn;
const { allowedNodeEnvironmentFlags } = require("node:process");
var helmet=require("helmet");

var app = express();

app.use(helmet({
    contentSecurityPolicy:{
        directives:{"default-src": ["'self'"], "font-src": ["'self'"], "img-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'"],"style-src": ["'self'", "'unsafe-inline'"], "frame-src": ["'self'"]}
    }
}));
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
    secret: process.env.COOKIE_SECRET || 'awdlawd122e12dwad',
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    cookie: {maxAge:600000}, //Session timeout 10 minutes
    path: "/",
    domain: "127.0.0.1",
    sameSite: 'strict',
    secure: true,
    store: new SQLiteStore({ db: 'sessions.db', dir: './db/' })
  }));
app.use(function(req, res, next) {
    if (!req.user) {
        res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.header('Expires', '-1');
        res.header('Pragma', 'no-cache');
    }
    next();
});
app.use(passport.initialize());
app.use(passport.session());
//app.use(csrf());
app.use(passport.authenticate('session'));
app.use(function(req, res, next) {
  var msgs = req.session.messages || [];
  res.locals.messages = msgs;
  res.locals.hasMessages = !! msgs.length;
  req.session.messages = [];
  next();
});
/*app.use(function(req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  next();
});*/

const PORT = process.env.PORT || 3000;
const DBFILE=process.env.db || './db/database.db';


let db = new sqlite3.Database(DBFILE, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the database.');
  });

passport.use(new LocalStrategy(function verify(username, password, cb) {
    if(!validateNoSpecialChars(username)){
        return cb(null, false, { message:'Invalid username entered.'});
    }
    db.get('SELECT * FROM users WHERE userId = ?', [ username ], function(err, row) {
        if (err) { return cb(err); }
        if (!row) { return cb(null, false, { message: 'Incorrect username or password.' }); }
            crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function(err, hashedPassword) {
        if (err) { return cb(err); }
        if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
            return cb(null, false, { message: 'Incorrect username or password.' });
        }
        return cb(null, row);
      });
    });
}));
passport.serializeUser(function(user, cb) {
  process.nextTick(function() {
    cb(null, { id: user.userId, accountType:user.accountType });
  });
});

passport.deserializeUser(function(user, cb) {
  process.nextTick(function() {
    return cb(null, user);
  });
});

/////////////////////////////////////////////////////////////////////////
// CORS Security configuration - origin will need to be modified in Prod. Maybe this is redundant, because Helmet is used?
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'localhost');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
////////////////////////////////////////////////////////////////////////
app.get('/', function(req,res){
    res.render('index',)   
});
app.get('/login', function(req,res){
    res.redirect('/',)   
});

app.get('/cards', ensureLoggedIn("/"), function(req, res, next){
    students=[];
    const [userId, studentName, accountType]=[req.user.id, req.params.studentName, req.user.accountType];
    if(req.user.accountType==2){
        db.all('SELECT userId FROM users WHERE accountType = 1', [], function(err, rows, next){
            if(err){return next('An unknown error occurred. Please try again later.');}
            else{
                rows.forEach(row =>{students.push(row.userId);});
                res.render('cards', {name:userId, at:accountType, students:students, currStudent:false, cards:[]});
            }
        });
    }
    else{
        db.all('SELECT * FROM cards WHERE userId = ?', [userId], function(err, rows, next){
            if(err){return next('An unknown error occurred. Please try again later.');}
            else{
                res.render('cards', {name:userId, at:accountType, students:[], currStudent:false, cards:JSON.stringify(rows)});
            }
        });
    }
});

app.get('/cards/students/:studentName', ensureLoggedIn("/"),function(req, res, next){
    if(req.user.accountType==1 || !validateNoSpecialChars(req.params.studentName)){res.redirect("/logout"); return;} //Should log them out here if they go to this address while not an admin, or if they manipulate the student name with XSS etc.
    const [userId, studentName, accountType]=[req.user.id, req.params.studentName, req.user.accountType];
    db.all('SELECT question,answer,color,image,cardId FROM cards WHERE userId = ?', [studentName], function(err, rows){
        if(err){return next('An unknown error occurred. Please try again later.');}
        else{res.render('cards', {name:userId, at:accountType, students:[], currStudent:studentName, cards:JSON.stringify(rows)});}
    });
});
app.post('/cards/students/:studentName/deleteallcards', ensureLoggedIn("/"),function(req, res){
    if(req.user.accountType==1 || !validateNoSpecialChars(req.params.studentName)){res.redirect("/logout"); return;} //Should log them out here if they go to this address while not an admin, or if they manipulate the student name with XSS etc.
    const [studentName]=[sanitize(req.params.studentName)];
    db.run(`DELETE FROM cards WHERE userId=(?)`, [studentName], function(err) {
        if (err) {return next(null, false, { message: 'An unknown error occurred trying to delete cards. Please try again later.' });}
        else{res.redirect('/cards/students/'+studentName);}
    });
});
app.post('/cards/students/:studentName/:question/:answer/:color/:image',function(req, res, next){
    if(req.user.accountType==1 || !validateNoSpecialChars(req.params.studentName) || !typeof(req.params.color)=='number'){res.redirect("/logout"); return;} //Should log them out here if they go to this address while not an admin, or if they manipulate the student name with XSS etc.
    const [studentName,question,answer,color,image]=[sanitize(req.params.studentName),sanitize(decodeURIComponent(req.params.question)),sanitize(decodeURIComponent(req.params.answer)),req.params.color,null]; //image currently not implemented
    db.run(`INSERT INTO cards(userId, question, answer, color, image) VALUES(?,?,?,?,?)`, [studentName,question,answer,color,image], function(err) {
        if (err) {return next(null, false, { message: 'An unknown error occurred trying to add cards. Please try again later.' });}
        else{res.redirect('/cards/students/'+studentName);}
    });
});
app.post('/cards/students/:studentName/:question/:answer/:color/:image/:replace', ensureLoggedIn("/"),function(req, res, next){
    if(req.user.accountType==1 || !validateNoSpecialChars(req.params.studentName)){res.redirect("/logout"); return;} //Should log them out here if they go to this address while not an admin, or if they manipulate the student name with XSS etc.
    const [studentName,question,answer,color,image]=[sanitize(req.params.studentName),sanitize(decodeURIComponent(req.params.question)),sanitize(decodeURIComponent(req.params.answer)),req.params.color,null]; //image currently not implemented
    db.run(`REPLACE INTO cards(cardId, userId, question, answer, color, image) VALUES(?,?,?,?,?,?)`, [req.params.replace,studentName,question,answer,color,image,], function(err) {
        if (err) {return next(null, false, { message: 'An unknown error occurred trying to add cards. Please try again later.' });}
        else{res.redirect('/cards/students/'+studentName);}
    });
});

app.get('/register', function(req,res){
    res.render('register',)   
});

app.post('/login', passport.authenticate('local', {
    successReturnToOrRedirect: '/cards',
    failureRedirect: '/',
    failureMessage: true
}));
app.get('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

//Validation and sanitization functions
function validateNoSpecialChars(testString){
    return testString.match(/^[0-9a-zA-Z]+$/)
}
function validateEmail(email){
    const res = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return res.test(String(email).toLowerCase());
}
function sanitize(string) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        "/": '&#x2F;',
        "`": '&grave;',
    };
    const reg = /[&<>"'/`]/ig;
    return string.replace(reg, (match)=>(map[match]));
  }
app.post('/register', function(req, res, next) {
    const { username, email, pwd, pwdConf } = req.body;
    // Validation
    if(!validateNoSpecialChars(username) || !validateEmail(email)){
        return next("Username or email contains invalid characters or format. Please try again");
    }
    if(pwd !== pwdConf){return next(`Passwords don't match`);}
    //Check for duplicates in db
    db.get('SELECT * FROM users WHERE email = ?', [ email ], function(err, row, next){
        if(err){return next('An unknown error occurred. Please try again later.');}
        else if(row){return next('Email already taken');}
        else{
            db.get('SELECT * FROM users WHERE userId = ?', [ username ], function(err, row, next){
                if(err){return next('An unknown error (1) occurred. Please try again later.');}
                else if(row){return next( 'Username already taken'); }
                else{// REGISTRATION
                    var salt = crypto.randomBytes(16);
                    crypto.pbkdf2(pwd, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
                        if(err){return next(null, false, { message: 'An unknown error (2) occurred. Please try again later.' });}
                        at=1;
                        if(username.includes("admin") || username.includes("Admin")){at=2;}
                        db.run(`INSERT INTO users(userId, email, hashed_password, salt, accountType) VALUES(?,?,?,?,?)`, [username,email, hashedPassword,salt,at], function(err, next) {
                            if (err) {return next(null, false, { message: 'An unknown error occurred (3). Please try again later.' });}
                            else{res.redirect('/')} //send the user to the login page
                        });
                    });
                }
            });
        }
    });
});

////////////////////////////////////////////////////////////////////////
app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0" , function(){
    console.log("Memory cards app now live");
  });