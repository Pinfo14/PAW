const createError = require("http-errors");
const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const { Staff } = require("./models/Users");
const authRouter = require("./routes/auth");
const adminRouter = require("./routes/adminGeral");
const restWorkerRouter = require("./routes/restWorker");
const restAdminRouter = require("./routes/restAdmin");
const resManage = require("./routes/restManag");
const clientsRouter = require("./routes/clients");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");

//RESTAPI
const apiAuthRouter = require("./routes/RESTAPI/auth");
const apiRestaurantsRouter = require("./routes/RESTAPI/restaurants");
const apiClientRouter = require("./routes/RESTAPI/clientProfile");
const apiOrdersRouter = require("./routes/RESTAPI/orders");
const apiGeoRouter = require("./routes/RESTAPI/geo");
const { mountSse } = require('./controllers/RESTAPI/sse');
var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.set("layout", "layout/restAdminLayout"); 
console.log("Views directory:", app.get("views"));
app.use(expressLayouts);
app.use(logger("dev"));
app.use(express.json({limit: '10mb'}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// cors
app.use(cors());

// // monta o SSE primeiro
 mountSse(app);

//routes API
app.use("/api/auth", apiAuthRouter);
app.use("/api/restaurants", apiRestaurantsRouter);
app.use("/api/client", apiClientRouter);
app.use("/api/orders", apiOrdersRouter);
app.use("/api/geo", apiGeoRouter);

//swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/api/v1/auth", apiAuthRouter);
app.use("/api/v1/restaurants", apiRestaurantsRouter);
app.use("/api/v1/client", apiClientRouter);
app.use("/api/v1/orders", apiOrdersRouter);
app.use("/api/v1/geo", apiGeoRouter);

//routes
app.use("/", authRouter);
app.use("/admin", adminRouter);
app.use("/rest", resManage);
app.use("/restAdmin", restAdminRouter);
app.use("/restWorker", restWorkerRouter);
app.use("/clients", clientsRouter);
app.use(
  "/uploads/comments",
  express.static(path.join(__dirname, "uploads/comments"))
);

//ligação ao mongoDB
const mongoCluster =
 
mongoose
  .connect(mongoCluster)
  .then(() => {
    app.listen(3000, () => {
      console.log("server is running on port 3000");
    });
    console.log("connected to database");

    adminCreation();
  })
  .catch(() => {
    console.log("connection failed");
  });

//Serve apenas para o programa ter sempre um admin geral no mongoDB
const adminCreation = function () {
  const adminEmail = "admin@geral.com";

  Staff.findOne({ email: adminEmail })
    .then(function (adminUser) {
      if (!adminUser) {
        console.log(
          "Nenhum Admin encontrado. Vai ser criado um Admin com o email: " +
            adminEmail
        );
        const hashedPassword = bcrypt.hashSync("12345", 10);

        const newAdmin = new Staff({
          email: adminEmail,
          password: hashedPassword,
          name: "Admin Geral",
          role: "Admin",
        });

        newAdmin
          .save()
          .then(() => {
            console.log("Admin criado com sucesso!");
          })
          .catch((err) => {
            console.error("Erro ao criar Admin:", err);
          });
      } else {
        console.log("Utilizador Admin já existe.");
      }
    })
    .catch(function (err) {
      console.error("Erro na verificação do Admin:", err);
    });
};

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
