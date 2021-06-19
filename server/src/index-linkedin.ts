
import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios";
import cors from "cors";
import querystring from "querystring";
import cookieParser from "cookie-parser";
import {
  SERVER_ROOT_URI,
  LINKEDIN_CLIENT_ID,
  JWT_SECRET,
  LINKEDIN_CLIENT_SECRET,
  COOKIE_NAME,
  UI_ROOT_URI,
} from "./config-linkedin";

const port = 4000;

const app = express();

app.use(
  cors({
    // Sets Access-Control-Allow-Origin to the UI URI
    origin: UI_ROOT_URI,
    // Sets Access-Control-Allow-Credentials to true
    credentials: true,
  })
);

app.use(cookieParser());

const redirectURI = "auth/linkedin";

function getGoogleAuthURL() {
  const rootUrl = "https://www.linkedin.com/oauth/v2/authorization";
  const options = {
    redirect_uri: `${SERVER_ROOT_URI}/${redirectURI}`,
    client_id: LINKEDIN_CLIENT_ID,
    access_type: "offline",
    response_type: "code",
    prompt: "consent",
    scope: [
      "r_liteprofile",
      "r_emailaddress",
    ].join(" "),
  };

  return `${rootUrl}?${querystring.stringify(options)}`;
}

// Getting login URL
app.get("/auth/linkedin/url", (req, res) => {
  return res.redirect(getGoogleAuthURL());
});

function getTokens({
  code,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  expires_in: Number;
  refresh_token: string;
  scope: string;
  id_token: string;
}> {
  /*
   * Uses the code to get tokens
   * that can be used to fetch the user's profile
   */
  const url = "https://www.linkedin.com/oauth/v2/accessToken";
  const values = {
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  };

  return axios
    .post(url, querystring.stringify(values), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    })
    .then((res) => res.data)
    .catch((error) => {
      console.error(`Failed to fetch auth tokens`);
      throw new Error(error.message);
    });
}

// Getting the user from Google with the code
app.get(`/${redirectURI}`, async (req, res) => {
  const code = req.query.code as string;

  const { id_token, access_token } = await getTokens({
    code,
    clientId: LINKEDIN_CLIENT_ID,
    clientSecret: LINKEDIN_CLIENT_SECRET,
    redirectUri: `${SERVER_ROOT_URI}/${redirectURI}`,
  });

  // Fetch the user's profile with the access token and bearer
  const googleUser = await axios
    .get(
      `https://api.linkedin.com/v2/me`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    )
    .then((res) => res.data)
    .catch((error) => {
      console.error(`Failed to fetch user`);
      throw new Error(error.message);
    });

    

  const token = jwt.sign(googleUser, JWT_SECRET);

  res.cookie(COOKIE_NAME, token, {
    maxAge: 900000,
    httpOnly: true,
    secure: false,
  });

  res.redirect('/auth/me');
});

// Getting the current user
app.get("/auth/me", (req, res) => {
  console.log("get me");
  try {
    const decoded = jwt.verify(req.cookies[COOKIE_NAME], JWT_SECRET);
    console.log("decoded", decoded);
    return res.send(decoded);
  } catch (err) {
    console.log(err);
    res.send(null);
  }
});

function main() {
  app.listen(port, () => {
    console.log(`App listening http://localhost:${port}`);
  });
}

main();
