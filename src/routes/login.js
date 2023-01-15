import { Router } from "express";
import passport from "passport";
import { logger } from "../../logger.js";
import rutaGet from "../../js/rutaGet.js";
import rutaPost from "../../js/rutaPost.js";

const login = Router()



login.get("/register",  (req, res) => {
    if (!req.isAuthenticated()) {
        const errorMensaje = req.session.messages ? req.session.messages[0] : ""
        res.render('formRegister', { error: errorMensaje })
        req.session.messages = [];
        rutaGet(req.path)
    } else {
        res.redirect("/")
    }
})

login.post("/register", passport.authenticate("singup", {
    failureRedirect: "/register",
    failureMessage: true
}), (req, res) => {
    rutaPost(req.path)
    res.redirect("/")

})

login.get("/login", async (req, res) => {
    if (!req.isAuthenticated()) {
        const errorMensaje = req.session.messages ? req.session.messages[0] : ""
        res.render("formLogin", { error: errorMensaje })
        req.session.messages = [];
        rutaGet(req.path)

    } else {
        res.redirect("/")
    }
})

login.post("/login", passport.authenticate("login", {
    failureRedirect: "/login",
    failureMessage: true
}), (req, res) => {
    rutaPost(req.path)
    res.redirect("/")
})


login.get("/logout", async (req, res) => {
    if (req.isAuthenticated()) {
        res.render("logout", { nombreUsuario: req.user.name })
        rutaGet(req.path)
    }
    else {
        res.redirect("/login")
    }
})

login.post("/logout", async (req, res) => {
    rutaPost(req.path)
    req.session.destroy()
})


export default login
