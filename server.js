import express from "express";
import { engine } from "express-handlebars";
import { Server } from "socket.io"
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import productRouter from "./src/routes/rutasProductos.js";
import { contenedorDaoChat } from "./daos/index.js";
import { normalize, schema } from "normalizr";
import { conectMongo } from "./conect/mongo.js";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import login from "./src/routes/login.js";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { userModels } from "./mongo/models/userModels.js";
import { config } from "./config/configDotenv.js"
import { createHash, compareHash } from "./bcrypt/createHash.js"
import info from "./src/routes/info.js";
import random from "./src/routes/randomNmr.js";
import prueba from "./src/routes/pruebaRandomNmr.js";
import parsedArgs from "minimist";
import { logger } from "./logger.js";
import { Console } from "console";




const objtArguments = parsedArgs(process.argv.slice(2))
const puerto = objtArguments.port && objtArguments.port != true ? objtArguments.port : 8080
//URL Mongo Atlas
const url = "mongodb://127.0.0.1:27017/chatMongo"//URL local
const usuariosDB = config.BDusuarios
conectMongo(usuariosDB)
const sessionsDB = config.BDSesiones
const claseChats = contenedorDaoChat
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();



const server = app.listen(puerto, () => {
    console.log(`server on port ${puerto} en el modo, ${config.Modo}, en el proceso ${process.pid}`)
})



const io = new Server(server)
//Schema normalizr

//schema para author
const authorEsquema = new schema.Entity("authors", {}, { idAttribute: "email" })
//Schema para mensajes
const schemaMessage = new schema.Entity("messages", { author: authorEsquema })
//Schema global
const schemaGlobal = new schema.Entity("globalChat", {
    messages: [schemaMessage]
}, { idAttribute: "id" })

//Funcion para normalizar datos
const dataNormalizer = (data) => {
    const normalizeData = normalize({ id: "chatHistory", messages: data }, schemaGlobal)
    return normalizeData
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// const carritoRouter = require("./routes/routerCarts")
// app.use("/api/productos-test", productTest)
// app.use("/api/carrito", cartRout)
// app.use("/api/productos", productRout)
app.engine("handlebars", engine());
app.set("views", "./src/views")
app.set("view engine", "handlebars")

//Crea Cookiess
app.use(cookieParser())
//Guarda las sesiones de las cookkiess en mongo
app.use(session({
    store: MongoStore.create({
        mongoUrl: sessionsDB,
        ttl: 600
    }),
    secret: config.claveSesion,
    resave: false,
    saveUninitialized: false,
}))


//Configuramo passport
app.use(passport.initialize())//Conecta passport a express
app.use(passport.session())//Relaciona sesiones con usuario

//Serealizacion de usuarios
passport.serializeUser((user, done) => {
    done(null, user.id)
})

//Deseralizar usuarios
passport.deserializeUser((id, done) => {
    userModels.findById(id, (err, userFound) => {
        if (err) return done(err);
        return done(null, userFound)
    })
})
//Seralizacion de contraseñas:

//Se utiliza para guardar el usuario con passport
passport.use("singup", new LocalStrategy(
    {
        passReqToCallback: true,
        usernameField: "email"
    },
    (req, userName, password, done) => {
        userModels.findOne({ userName: userName }, (err, userFound) => {
            if (err) return done(err, null, { message: "Hubo un erro al verificar el usuario" })
            if (userFound) return done(null, null, { message: "El usuario ya existe" })
            const newUser = {
                name: req.body.name,
                userName: userName,
                password: createHash(password)
            }
            userModels.create(newUser, (err, userCreated) => {
                if (err) return done(err, null, { message: "no se pudo guardar el usuario" })
                return done(null, userCreated)
            })
        })
    }
))

//Funcion para comprar las contraseñas hasheadas

passport.use("login", new LocalStrategy(
    {
        passReqToCallback: true,
        usernameField: "email"
    },
    (req, userName, password, done) => {
        userModels.findOne({ userName: userName }, (err, userFound) => {
            if (err) return done(err, null, { message: "Hubo un error  al verificar el usuario" })
            const passHash = compareHash(password, userFound.password)
            if (userFound && passHash) {
                return done(null, userFound)
            } else {
                return done(null, null, { message: "El usuario y/o contraseña es incorrecta" })
            }

        })
    }
))

//Rutas

app.use("/", productRouter)
app.use("/", login)
app.use("/", info)
app.use("/", random)
app.use("/", prueba)
app.use(express.static(__dirname + "/src/views/layouts"))
app.get("*", (req, res) => {
    logger.warn(`Se intento ingresar al a ruta ${req.path}`)
})





//Pasar el socket a un endpoint para hacer funcionar el chat y tomar los datos
//O usar passport para enviar el usuario asi funciona el chat

io.on("connection", async (socket) => {
    try {
        const chatNormalizer = await claseChats.obtenerMensajes()
        const historicoDelChat = dataNormalizer(chatNormalizer)
        // console.log(historicoDelChat)
        //     socket.on("envioProducto", async (datoRecibido) => {
        //         try {
        //             // await contenedorProducts.save(datoRecibido)
        //             // actualizarProductos = await contenedorProducts.getAll()
        //             socket.emit("todosLosProductos", actualizarProductos)
        //         } catch (error) {
        //             res.status(500).send("Hubo un error en el Servidor")
        //         }
        //     })
        socket.broadcast.emit("newUser", socket.id)
        if (historicoDelChat) {
            socket.emit("todosLosMensajes", historicoDelChat)
        }
        socket.on("envioMensajesFront", async (datoCliente) => {
            try {
                await claseChats.agregarMensaje(datoCliente)
                const chatNormalizer = await claseChats.obtenerMensajes()
                const allChats = dataNormalizer(chatNormalizer)
                io.sockets.emit("todosLosMensajes", allChats)
            } catch (error) {
                console.log(error)
            }
        })
        socket.on("envioUsuario", (usuario) => {
            // console.log(usuario)
        })
    } catch (error) {
        console.log(error)
        logger.error(`Se produjo un error en el chat, el error es: ${error}`)
    }
})

