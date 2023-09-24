const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let dataBase;

const initializeDBAndServer = async () => {
  try {
    dataBase = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started!!");
    });
  } catch (error) {
    console.log(`DB Error${error.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

const convertDbResponse = (eachObj) => {
  return {
    stateId: eachObj["state_id"],
    stateName: eachObj["state_name"],
    population: eachObj["population"],
  };
};

const convertDistrictResponse = (dbObject) => {
  return {
    districtId: dbObject["district_id"],
    districtName: dbObject["district_name"],
    stateId: dbObject["state_id"],
    cases: dbObject["cases"],
    cured: dbObject["cured"],
    active: dbObject["active"],
    deaths: dbObject["deaths"],
  };
};

//AUTHENTICATION TOKEN API
const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }

  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "secret", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//LOGIN API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const user = await dataBase.get(getUserQuery);
  if (user === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (isPasswordMatch) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "secret");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//GET STATES API
app.get("/states/", authenticationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`;
  const statesArray = await dataBase.all(getStatesQuery);
  response.send(statesArray.map((eachObj) => convertDbResponse(eachObj)));
});

//GET STATE API
app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = '${stateId}';`;
  const state = await dataBase.get(getStateQuery);
  response.send(convertDbResponse(state));
});

//CREATE DISTRICT API

app.post("/districts/", authenticationToken, async (request, response) => {
  const newDistrict = request.body;
  const { districtName, stateId, cases, cured, active, deaths } = newDistrict;
  const insertDistrictQuery = `
    INSERT INTO
    district
    (district_name, state_id, cases, cured, active, deaths)
    VALUES ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths})
    ;`;
  await dataBase.run(insertDistrictQuery);
  response.send("District Successfully Added");
});

//GET DISTRICT API
app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT *
    FROM
    district
    WHERE district_id = ${districtId}
    ;`;

    const districtObject = await dataBase.get(getDistrictQuery);
    response.send(convertDistrictResponse(districtObject));
  }
);

//DELETE DISTRICT API
app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
    DELETE
    FROM
    district
    WHERE district_id = ${districtId}
    ;`;

    await dataBase.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//UPDATE DISTRICT API
app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
    UPDATE district
    SET  
    district_name = '${districtName}', 
    state_id = ${stateId}, 
    cases = ${cases}, 
    cured = ${cured}, 
    active = ${active}, 
    deaths = ${deaths}
    WHERE district_id = ${districtId}
    ;`;

    await dataBase.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//GET STATISTICS API
app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatsQuery = `
   SELECT 
    SUM(cases) AS totalCases,
    SUM(cured) AS totalCured,
    SUM(active) AS totalActive,
    SUM(deaths) AS totalDeaths
FROM 
    district
WHERE 
    state_id = ${stateId};
    `;

    const statsObject = await dataBase.get(getStatsQuery);
    response.send(statsObject);
  }
);

//GET STATE NAME API
app.get(
  "/districts/:districtId/details/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getStateNameQuery = `
    SELECT
    state.state_name AS stateName
FROM
    District
JOIN
    state ON district.state_id = state.state_id
WHERE
    district.district_id = ${districtId};`;

    const stateNameObject = await dataBase.get(getStateNameQuery);
    response.send(stateNameObject);
  }
);

module.exports = app;
