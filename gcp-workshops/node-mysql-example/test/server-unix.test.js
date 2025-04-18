// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

const path = require("path");
const request = require("supertest");
const assert = require("assert");

const SAMPLE_PATH = path.join(__dirname, "../server.js");

const _db_host_backup = process.env.DB_HOST;
delete process.env.DB_HOST;

const serverUnix = require(SAMPLE_PATH);

after(() => {
  serverUnix.close();
  process.env.DB_HOST = _db_host_backup;
});

it("should display the default via unix socket", async () => {
  await request(serverUnix)
    .get("/")
    .expect(200)
    .expect((response) => {
      assert.ok(response.text.includes("Tabs VS Spaces"));
    });
});

it("should handle insert error via unix", async () => {
  const expectedResult = "Invalid team specified";

  await request(serverUnix)
    .post("/")
    .expect(400)
    .expect((response) => {
      assert.ok(response.text.includes(expectedResult));
    });
});
