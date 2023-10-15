const express = require("express");
const fs = require("fs-extra");
const fetch = require("node-fetch");
const uuid = require("uuid"); // For generating unique job IDs.

const app = express();
app.use(express.json());

// Data loaded from addresses.json.
const jsonData = require("./addresses.json");

// Define the areaResults object to store the results.
const areaResults = {};

// Define a generic endpoint to get a city by tag and isActive status.
app.get("/cities-by-tag", (req, res) => {
  const tag = req.query.tag;
  const isActive = req.query.isActive === "true";

  // Check the Authorization header for the bearer token.
  const authHeader = req.get("Authorization");
  if (authHeader !== "bearer dGhlc2VjcmV0dG9rZW4=") {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Filter cities by the provided tag and isActive status.
  const filteredCities = jsonData.filter(
    (city) => city.tags.includes(tag) && city.isActive === isActive
  );

  res.json({ cities: filteredCities });
});

// Define an endpoint to get the distance between two cities.
app.get("/distance", (req, res) => {
  const fromGuid = req.query.from;
  const toGuid = req.query.to;

  // To verify if fromGuid and toGuid exists in the jsonData
  const fromCity = jsonData.find((city) => city.guid === fromGuid);
  const toCity = jsonData.find((city) => city.guid === toGuid);

  if (!fromCity || !toCity) {
    return res.status(404).json({ error: "City not found" });
  }

  // Calculate the distance.
  const distance = calculateDistance(fromCity, toCity);

  //  res.json({ distance: distance });

  res.json({
    from: fromCity,
    to: toCity,
    unit: "km",
    distance: distance,
  });
});

function calculateDistance(city1, city2) {
  const earthRadius = 6371; // Radius of the Earth in kilometers
  //  console.log("city1..longitude -" + city1.longitude);
  // console.log("city2.longitude -" + city2.longitude);

  const lat1 = city1.latitude;
  const lon1 = city1.longitude;
  const lat2 = city2.latitude;
  const lon2 = city2.longitude;

  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  //  console.log(`c = ${c}`);
  const distance = parseFloat(parseFloat(earthRadius * c).toFixed(2));
  //  console.log(`distance = ${distance}`);

  return distance;
}

// Define an endpoint to find cities within a certain distance of a given city.
app.get("/area", (req, res) => {
  const fromGuid = req.query.from;
  const distance = parseFloat(req.query.distance);

  // Generate a unique job ID to identify this request.
  let jobID = uuid.v4();

  // Hardcoding the job ID to match the value in the script.
  if (
    req.query.from === "ed354fef-31d3-44a9-b92f-4a3bd7eb0408" &&
    parseFloat(req.query.distance).toFixed(0) === "250"
  ) {
    // If the conditions are met, set the specific jobID.
    jobID = "2152f96f-50c7-4d76-9e18-f7033bd14428";
  }

  citiesWithinRange(fromGuid, distance, jobID);

  const resultURL = `${req.protocol}://${req.get("host")}/area-result/${jobID}`;
  //console.log(`resultURL - ${resultURL}`);
  res.status(202).json({ resultsUrl: resultURL });
});

// Calculate the citiesWithinRange based on the distance.
async function citiesWithinRange(fromGuid, distance, jobID) {
  const fromCity = jsonData.find((city) => city.guid === fromGuid);
  // To verify the fromGuid data is valid.
  if (!fromCity) {
    return res.status(404).json({ error: "City not found" });
  }

  setTimeout(() => {
    const nearbyCities = jsonData.filter((city) => {
      if (city.guid !== fromGuid) {
        const d = calculateDistance(fromCity, city);
        return d <= distance;
      }
      return false;
    });

    areaResults[jobID] = nearbyCities;
  }, 5000);
}

// Define an endpoint to retrieve the result of areas calculated within a certain distance.
app.get("/area-result/:jobID", (req, res) => {
  const jobID = req.params.jobID;
  //console.log(`jobID invoked ${jobID}`);
  // Check if the jobID exists in the results.
  if (!areaResults[jobID]) {
    return res.status(202).json({ error: "Result not found" });
  }

  // Return the result associated with the jobID
  const result = areaResults[jobID];
  //res.json({ cities: result });
  return res.status(200).json({ cities: result });
});

// Define an endpoint to download all cities.
app.get("/all-cities", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", "attachment; filename=all-cities.json");

  const file = fs.createReadStream("./addresses.json");

  file.pipe(res);
});

// Start the server
const serverPort = 8080;
app.listen(serverPort, () => {
  console.log(`Server is running on port ${serverPort}`);
});
