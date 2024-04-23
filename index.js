var express = require("express");
var passport = require('passport');
var session = require('express-session');
var cookieParser = require('cookie-parser');
//var csrf = require('csurf');
var SQLiteStore = require('connect-sqlite3')(session);
var sqlite3 = require('sqlite3').verbose();
var LocalStrategy = require('passport-local');
var crypto = require('crypto');
//var crypto = require('node:crypto'); //This might be better


var app = express();

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(session({
    secret: 'keyboard cat',
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    store: new SQLiteStore({ db: 'sessions.db', dir: './db/' })
  }));
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
const DBFILE='./db/database.db';


let db = new sqlite3.Database(DBFILE, sqlite3.OPEN_READWRITE, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Connected to the database.');
  });

passport.use(new LocalStrategy(function verify(username, password, cb) {
    db.get('SELECT * FROM users WHERE userId = ?', [ username ], function(err, row) {
        if (err) { return cb(err); }
        if (!row) { return cb(null, false, { message: 'Incorrect username or password.' }); }
            crypto.pbkdf2(password, row.salt, 310000, 32, 'sha256', function(err, hashedPassword) {
        if (err) { return cb(err); }
            console.log(row.hashed_password, hashedPassword);
        if (!crypto.timingSafeEqual(row.hashed_password, hashedPassword)) {
            console.log("Login not successful");
            return cb(null, false, { message: 'Incorrect username or password.' });
        }
        console.log("Login successful");
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

/*
passport.use(new LocalStrategy(
    function(username, password, done) {
      User.findOne({ username: username }, function (err, user) {
        if (err) { return done(err); }
        if (!user) { return done(null, false); }
        if (!user.verifyPassword(password)) { return done(null, false); }
        return done(null, user);
      });
    }
  ));
*/


/////////////////////////////////////////////////////////////////////////
// Incorrect CORS Security configuration #TODO remove or correct
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
});
////////////////////////////////////////////////////////////////////////
// open database

// close database
function closeDB(){
    db.close((err) => {
        if (err) {
          console.error(err.message);
        }
        console.log('Close the database connection.');
      });
}

/*
function isAuthenticated() {
    return function (req, res, next) {
      if (req.isAuthenticated()) {
        return next()
      }
      res.redirect('/')
    }
  }

function authenticate(req){
    user=req.body['username'];
    pswrd=req.body['password'];
    console.log(user);
    console.log(pswrd);
    let accountType=0;
    db.all("SELECT accountType FROM users WHERE userId='$1' AND password='$2';",[user,pswrd],(err,rows)=>{
        console.log(rows);
        if(err){
            console.error(err.message);
        }
        rows.forEach((row) => {
            console.log(row.accountType);
            accountType= row.accountType;
        });
    });
    return accountType; //Why does it give "Undefined"?
}
*/

////////////////////////////////////////////////////////////////////////
app.get('/', function(req,res){
    res.render('index',)   
});
app.get('/login', function(req,res){
    res.render('index',)   
});

app.get('/cards', function(req, res){
    console.log(req.user);
    students=[];
    if(req.user.accountType==2){
        db.all('SELECT userId FROM users WHERE accountType = 1', [], function(err, rows){
            if(err){
                return next('An unknown error occurred. Please try again later.');
            }
            else{
                rows.forEach(row =>{
                    students.push(row.userId);
                });
                res.render('cards', {name:req.user.id, at:req.user.accountType, students:students, currStudent:false, cards:[]});
            }
        });
    }
    else{
        db.all('SELECT * FROM cards WHERE userId = ?', [req.user.id], function(err, rows){
            if(err){
                return next('An unknown error occurred. Please try again later.');
            }
            else{
                console.log(rows);
                res.render('cards', {name:req.user.id, at:req.user.accountType, students:[], currStudent:false, cards:JSON.stringify(rows)});
            }
        });
    }
});

app.get('/cards/students/:studentName',function(req, res){
    console.log(req.params.studentName);
    db.all('SELECT question,answer,color,image,cardId FROM cards WHERE userId = ?', [req.params.studentName], function(err, rows){
        if(err){
            return next('An unknown error occurred. Please try again later.');
        }
        else{
            //console.log(rows);
            res.render('cards', {name:req.user.id, at:req.user.accountType, students:[], currStudent:req.params.studentName, cards:JSON.stringify(rows)});
        }
    });
});
app.post('/cards/students/:studentName/deleteallcards',function(req, res){
    console.log(req.params);
    db.run(`DELETE FROM cards WHERE userId=(?)`, [req.params.studentName], function(err) {
        if (err) {
            console.log(err);
            res.redirect('/cards/students/'+req.params.studentName);
        }
        else{
            //return next();
            res.redirect('/cards/students/'+req.params.studentName);
        }
    });
});
app.post('/cards/students/:studentName/:question/:answer/:color/:image',function(req, res, next){
    console.log(req.params);
    //console.log(res);
    db.run(`INSERT INTO cards(userId, question, answer, color, image) VALUES(?,?,?,?,?)`, [req.params.studentName,req.params.question, req.params.answer,req.params.color,req.params.image], function(err) {
        if (err) {
            console.log(err);
            return next(null, false, { message: 'An unknown error occurred trying to add cards. Please try again later.' });
        }
        else{
            //return next();
            res.redirect('/cards/students/'+req.params.studentName);
        }
    });
});
app.post('/cards/students/:studentName/:question/:answer/:color/:image/:replace',function(req, res, next){
    console.log(req.params);
    //console.log(r);
    db.run(`REPLACE INTO cards(cardId, userId, question, answer, color, image) VALUES(?,?,?,?,?,?)`, [req.params.replace,req.params.studentName,req.params.question, req.params.answer,req.params.color,req.params.image], function(err) {
        if (err) {
            console.log(err);
            return next(null, false, { message: 'An unknown error occurred trying to add cards. Please try again later.' });
        }
        else{
            //return next();
            res.redirect('/cards/students/'+req.params.studentName);
        }
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
app.post('/logout', function(req, res, next) {
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/');
    });
  });

app.post('/register', function(req, res, next) {
    const { username, email, pwd, pwdConf } = req.body;
    
    // VALIDATION
    const errors = [];

    if(pwd !== pwdConf){
        return next(`Passwords don't match`);
    }
    db.get('SELECT * FROM users WHERE email = ?', [ email ], function(err, row){
        if(err){
            return next('An unknown error occurred. Please try again later.');
        }
        else if(row){
            return next('Email already taken');
        }
        else{
            db.get('SELECT * FROM users WHERE userId = ?', [ username ], function(err, row){
                if(err){
                 return next('An unknown error (1) occurred. Please try again later.');
                }
                else if(row){
                    return next( 'Username already taken');
                }
                else{
                    // REGISTRATION
                    var salt = crypto.randomBytes(16);
                    crypto.pbkdf2(pwd, salt, 310000, 32, 'sha256', function(err, hashedPassword) {
                        if(err){
                            return next(null, false, { message: 'An unknown error (2) occurred. Please try again later.' });
                        }
                        at=1;
                        if(username.includes("admin") || username.includes("Admin")){
                            at=2;
                        }
                        console.log(username,email, hashedPassword,salt,at);
                        db.run(`INSERT INTO users(userId, email, hashed_password, salt, accountType) VALUES(?,?,?,?,?)`, [username,email, hashedPassword,salt,at], function(err) {
                            if (err) {
                                return next(null, false, { message: 'An unknown error occurred (3). Please try again later.' });
                            }
                            else{
                                res.redirect('/')
                            }
                        });
                    });
                }
            });
        }
    });
});

/*
app.post('/submit', function(req, res){
    at=authenticate(req);
    console.log(at);
    if(at==0){
        res.send("ERROR: Username and password do not match a current user. Go back and try again!");
        //res.redirect('/');
    }
    else if(at==1){
        console.log("You are now connected as a student");
        res.send("Authentication successful")
    }
    else if(at==2){
        console.log("You are now connected as a teacher");
        res.send("Authentication successful")
    }
    else{
        res.sendStatus(500);
    }
    

});
*/

////////////////////////////////////////////////////////////////////////
app.listen(process.env.PORT || 3000, process.env.IP || "0.0.0.0" , function(){
    console.log("Memory cards app now live");
  });





/*
const users = [
    { id: 1, username: 'admin', isAdmin: true },
    { id: 2, username: 'user', isAdmin: false }
];

// Middleware to simulate user authentication
function authenticate(req, res, next) {
    const userId = 2;
    const user = users.find(u => u.id == userId);
    if (!user) {
        return res.status(401).send('Unauthorized');
    }
    req.user = user;
    next();
}

// Middleware to restrict access to admin-only pages
function requireAdmin(req, res, next) {
    if (!req.user.isAdmin) {
        return res.status(403).send('Forbidden');
    }
    next();
}




// **********************************  Code from here **************************
app.get('/', function(req,res){
   
        res.render('home',)   
    
    
})

app.get('/profile', authenticate, function(req,res){
   
    res.render('profile',)   


})

app.get('/orders', authenticate, requireAdmin, function(req,res){
   
    res.render('orders',)   


})


app.get('/register', function(req,res){
   
    res.render('register',)   


})

app.post('/register', (req, res) => {
    const { username, email } = req.body;

    if (!username) {
        console.log("No Username Given " )

    } else {
        console.log("The user is "  + username)
    }


    res.redirect('/')
});





// **********************************  Code to here **************************








app.get('/newuser/', function(req,res){
   // anyone but the blanks profile
    res.render('badprofile',)   


})




// app.use((req, res, next) => {
//     const allowedOrigins = ['http://example.com', 'https://example.com']; // Specify allowed origins
//     const origin = req.headers.origin;
    
//     if (allowedOrigins.includes(origin)) {
//         res.setHeader('Access-Control-Allow-Origin', origin);
//     }

//     res.setHeader('Access-Control-Allow-Methods', 'GET, POST'); // Specify allowed methods
//     res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Specify allowed headers
    
//     // Handle preflight requests
//     if (req.method === 'OPTIONS') {
//         res.status(200).end();
//     } else {
//         next();
//     }
// });
*/