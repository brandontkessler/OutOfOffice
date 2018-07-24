'use strict';
const path = require('path'),
	express = require('express'),
	app = express(),
	server = require('http').Server(app),
	io = require('socket.io')(server),
	session = require('express-session'),
	bodyParser = require('body-parser'),
	flash = require('connect-flash'),
	mongoose = require('mongoose'),
	passport = require('passport'),
	helmet = require('helmet'),
	morgan = require('morgan'),
	methodOverride = require('method-override'),
	OutOfOffice = require(path.join(__dirname, 'app'))

mongoose.connect(OutOfOffice.config.dbURI)
app.use(bodyParser.urlencoded({extended: true}))
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))
app.use(methodOverride("_method"))
app.use(flash())
app.use(helmet())

// EXPRESS SESSION CONFIG
app.use(session(OutOfOffice.session))
app.use(passport.initialize())
app.use(passport.session())
app.use(morgan('combined', {
	stream: {
		write: message => {
			OutOfOffice.logger.log('info', message)
		}
	}
}))

// invoke social authentication
require(path.join(__dirname, 'app', 'auth'))()

// Send data to static files
app.use((req, res, next) => {
	res.locals.currentUser = req.user
	res.locals.error = req.flash("error")
  res.locals.success = req.flash("success")
	next()
})

// ROUTES
app.use(OutOfOffice.homeRoutes)
app.use(OutOfOffice.authRoutes)
app.use('/homebase', OutOfOffice.homebaseRoutes)
app.use('/company-dashboard', OutOfOffice.companyDashboardRoutes)
app.get('*', (req, res) => res.status(404).send('404 unable to find page!'))

// SOCKET
OutOfOffice.chatIo(io, OutOfOffice.Chat, OutOfOffice.User, OutOfOffice.Company)

server.listen(OutOfOffice.config.port, () => console.log(`OutOfOffice started on port ${OutOfOffice.config.port}`))
