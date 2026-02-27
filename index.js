require('dotenv').config();
const express=require('express');
const aws=require('aws-sdk');
const fs=require('fs');
const mongoose=require('mongoose');
const path=require('path');
const bcrypt=require('bcrypt');
const bodyParser=require('body-parser');
const multer = require('multer');
const app=express();

const upload = multer({ dest: 'uploads/' });

// S3 Helper function
function getS3Client() {
    return new aws.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    });
}

//app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
//app.use(express.urlencoded({extended : true}));
//let b = mongoose.connect(process.env.MONGODB_URI);
//b.then(()=>{
 //       console.log('MongoDB Connection succesful');
//});
//b.catch(err=>{
  //  console.log('Connection failed');
//});
let loginSchema = new mongoose.Schema(
    {
       user: String,
       pass: String 
    },
    {versionKey:false}
);
let loginModel = new mongoose.model("user",loginSchema,"users");

app.get('/',(req,res)=>{
    res.sendFile(__dirname+'/public/login.html');
});

app.get('/signup',(req,res)=>{
    res.sendFile(__dirname+'/public/signup.html');
});

app.get('/home',(req,res)=>{
    res.sendFile(__dirname+'/public/home.html');
});

app.post('/login',async (req,res)=>{
    try{
        const {username, password} = req.body;
        const userOne = await loginModel.findOne({user:username});
        if(!userOne){
            res.status(404).send("Invalid username");
        }
        const passMatch = await bcrypt.compare(password, userOne.pass);
        if(passMatch)
            //res.send("Login Successful");
        res.redirect('/home');
        else
            res.status(403).send("Invalid credentials");
    }catch(err){
        console.error(err);
    }
});

app.post('/register',async (req,res)=>{
    let {username, password}=req.body;
    try{
        const cpassword =  await bcrypt.hash(password, 10);
        const newUser = new loginModel({
            user:username,pass : cpassword,
        });
        await newUser.save();
        res.redirect('/');
    }catch(err){
        //console.error(err);
        res.status(500).send("Error");
    }
});

app.post('/upload', upload.single('picture'), async (req,res)=>{
    try {
        const s3 = getS3Client();

        if (!req.file) {
            return res.status(400).send('No file uploaded');
        }

        const fileContent = fs.readFileSync(req.file.path);
        const params = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: req.file.originalname,
            Body: fileContent,
            ContentType: req.file.mimetype
        };

        s3.upload(params, (err, data) => {
            // remove temp file
            try { fs.unlinkSync(req.file.path); } catch(e){}

            if(err) {
               // console.log(err);
                return res.status(500).send("Upload failed");
            } else {
                //console.log("Upload successful");
                return res.status(200).send("Upload successful");
            }
        });
    } catch (err) {
        //console.error(err);
        res.status(500).send('Error');
    }
});

app.get('/download',(req,res)=>{
    res.sendFile(__dirname+'/public/download.html');
});

app.get('/api/files', async (req,res)=>{
    try {
        const s3 = getS3Client();

        const params = { Bucket: process.env.AWS_S3_BUCKET_NAME };
        s3.listObjects(params, (err, data) => {
            if(err) {
                return res.status(500).json({ error: 'Failed to list files' });
            }
            const files = data.Contents.map(obj => obj.Key);
            res.json(files);
        });
    } catch (err) {
        //console.error(err);
        res.status(500).json({ error: 'Error retrieving files' });
    }
});

app.get('/download/:filename', async (req,res)=>{
    try {
        const s3 = getS3Client();

        const filename = req.params.filename;
        const params = { 
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: filename
        };

        s3.getObject(params, (err, data) => {
            if(err) {
                return res.status(404).send('File not found');
            }
            res.setHeader('Content-Type', data.ContentType);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(data.Body);
        });
    } catch (err) {
        //console.error(err);
        res.status(500).send('Error downloading file');
    }
});

module.exports=app;
