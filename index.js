const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);
let port = process.env.PORT || 3000;
const { Client } = require("pg");

const client = new Client({
  connectionString:
    "postgres://bcgndofopgnhue:55fd71e4db871a3158b1699f6768e439f64ca74c673cc73f31f3a2ffb36ac28a@ec2-52-86-2-228.compute-1.amazonaws.com:5432/d2koer7v92n21g",
  ssl: {
    rejectUnauthorized: false,
  },
});

client.connect();

var blockSize = 0;

io.on("connection", (socket) => {
  console.log("A user connected: " + socket.id);

  socket.on("add username", (args) => {
    console.log(args);
    client.query(
      `update users3 set username = $1 where user_id = $2;`,
      args,
      (err, res) => {
        console.log(res);
        client.query(
          `insert into pending_transactions3 (from_add, to_add, amount) values ('Welcome Reward', $1, 1000);`,
          [args[0]]
        );
      }
    );
  });

  socket.on("fetch username", (args) => {
    console.log("This is inside fetch username");
    console.log(args);
    client.query(
      "select username from users3 where user_id = $1;",
      [args],
      (err, res) => {
        console.log("Look here dumbo....");
        console.log(res.rows[0].username);
        io.to(socket.id).emit("get username", res.rows[0].username);
      }
    );
  });

  socket.on("check user name", (args) => {
    console.log("NEW USER TRYING TO REGISTER USER ANEM");
    console.log(args);
    client.query(
      "select username from users3 where username = $1;",
      [args],
      (err, res) => {
        console.log(res.rowCount);
        if (res.rowCount == 0) {
          io.to(socket.id).emit("set username", true);
        } else {
          io.to(socket.id).emit("set username", false);
        }
      }
    );
  });

  socket.on("user_registration", (userToken) => {
    console.log("This is inside user_registration..");
    console.log(userToken);

    client.query(
      `select user_id from users3 where user_id = $1;`,
      [userToken.sub],
      (err, res) => {
        console.log("This is where u should look now:", res);
        if (res.rowCount == 0) {
          console.log("NEW USER!!!!!!!YAYYAYAYA");
          client.query(
            `insert into users3 (user_id, picture) values ($1, $2);`,
            [userToken.sub, userToken.picture],
            (err, res) => {
              if (err) {
                console.log(err);
              } else {
                console.log(
                  "New User SUCESSFULLY registered: ",
                  userToken.name
                );
                io.to(socket.id).emit("user login", { isNewUser: true });
              }
            }
          );
        } else {
          io.to(socket.id).emit("user login", { isNewUser: false });
        }
      }
    );
  });

  socket.on("fetch users", (count) => {
    console.log("FETCH USERS request received from USER: ", socket.id);
    console.log("TOTAL USERS FETCHED: ", count);

    if (count >= 0) {
      console.log("FETCHING USERS...");
      client.query(
        `SELECT * FROM users3 WHERE id > $1;`,
        [count],
        (err, res) => {
          if (err) throw err;
          io.to(socket.id).emit("update users", { data: res.rows });
          console.log("USERS SENT:");
          console.log({ data: res.rows });
        }
      );
    }
  });

  socket.on("fetch blocks", (count) => {
    console.log("FETCH BLOCKS request received from USER: ", socket.id);
    console.log("TOTAL BLOCKS FETCHED: ", count);

    if (count > 0) {
      console.log("FETCHING BLOCKS...");
      client.query(
        `SELECT * FROM blocks3 WHERE id > $1;`,
        [count],
        (err, res) => {
          if (err) throw err;
          io.to(socket.id).emit("update blocks", { data: res.rows });
          console.log("BLOCKS SENT:");
          console.log({ data: res.rows });
        }
      );
    }
  });

  socket.on("fetch transactions", (count) => {
    console.log("FETCH TRANSACTIONS request received from USER: ", socket.id);
    console.log("TOTAL TRANSACTIONS FETCHED: ", count);
    console.log("HELOSSSSSSSSSSSSSSSSSSSSSS");

    if (count >= 0) {
      console.log("FETCHING TRANSACTIONS...");
      client.query(
        `SELECT b_id, from_add, to_add, amount FROM transactions3 WHERE id > ${count};`,
        (err, res) => {
          if (err) throw err;
          io.to(socket.id).emit("update transactions", { data: res.rows });
          console.log("TRANSACTIONS SENT:");
          console.log({ data: res.rows });
        }
      );
    }
  });

  socket.on("fetch pending transactions", (callback) => {
    console.log(
      "FETCH PENDING TRANSACTIONS request received from user: ",
      socket.id
    );
    if (blockSize == 0) {
      console.log("FIRST MINER: ", socket.id);
      client.query(
        "SELECT from_add, to_add, amount FROM pending_transactions3;",
        (err, res) => {
          if (err) throw err;
          console.log("Number of transactions sent: ", res.rowCount);
          blockSize = res.rowCount;
          io.to(socket.id).emit("pending transactions", { data: res.rows });
          console.log("PENDING TRANSACTIONS SENT:");
          console.log({ data: res.rows });
        }
      );
    } else {
      console.log("NOT FIRST MINER: ", socket.id);
      client.query(
        "SELECT from_add, to_add, amount FROM pending_transactions3 ORDER BY id LIMIT $1;",
        [blockSize],
        (err, res) => {
          if (err) throw err;
          console.log("Number of transactions sent: ", res.rowCount);
          io.to(socket.id).emit("pending transactions", { data: res.rows });
          console.log("PENDING TRANSACTIONS SENT:");
          console.log({ data: res.rows });
        }
      );
    }
  });

  socket.on("block mined", (args) => {
    var prev_hash = "";
    console.log("BLOCK MINED by: ", socket.id);
    console.log(args);
    console.log([args[1], args[2]]);

    console.log("CHECKING IF THE BLOCK IS PREVIOUSLY MINED");
    client.query(
      "select prev_hash from blocks3 order by id desc limit 1;",
      (err, res) => {
        if (err) throw err;
        console.log(res);
        prev_hash = res.rows[0].prev_hash;
        console.log("===========================================");
        console.log(res.rows[0].prev_hash, typeof res.rows[0].prev_hash);
        console.log(args[0], typeof args[0]);
        console.log("===========================================");
        if (prev_hash == args[0]) {
          console.log("The block has been mined already");
        } else {
          console.log("You are the first one to mine");

          console.log("NEW BLOCK INSERTED ON SERVER SIDE");
          client.query(
            "INSERT INTO blocks3 (prev_hash, hash, nonce) VALUES ((SELECT hash FROM blocks3 ORDER BY id DESC LIMIT 1), $1, $2);",
            [args[1], args[2]],
            (err, res) => {
              if (err) throw err;
              console.log("ADD NEW BLOCK event emitted");
              io.emit("add new block", [args[1], args[2]]);
              console.log("This block data is emitted::", args);
            }
          );

          client.query(
            "SELECT * FROM pending_transactions3 limit $1;",
            [blockSize],
            (err, res) => {
              if (err) throw err;
              console.log("ADD NEW TRANSACTIONS event emitted");
              io.emit("add new transactions", { data: res.rows });
              console.log({ data: res.rows });
            }
          );

          console.log("TRANSACTIONS ADDED ON SERVER SIDE");
          client.query(
            "INSERT INTO transactions3 (b_id, from_add, to_add, amount) SELECT b.id, t.from_add, t.to_add, t.amount FROM blocks3 b CROSS JOIN pending_transactions3 t WHERE b.id = (SELECT id FROM blocks3 ORDER BY id DESC LIMIT 1) LIMIT $1;",
            [blockSize],
            (err, res) => {
              if (err) throw err;
            }
          );

          console.log("MINING REWARD TRANSACTION ADDED ON SERVER SIDE");
          client.query(
            "INSERT INTO transactions3 (b_id, from_add, to_add, amount) VALUES ((select b_id from transactions3 order by id desc limit 1), $1, $2, $3);",
            args[3],
            (err, res) => {
              if (err) throw err;
            }
          );

          client.query(
            "SELECT * FROM transactions3 order by id desc limit 1;",
            (err, res) => {
              if (err) throw err;
              console.log("ADD NEW REWARD TRANSACTIONS event emitted");
              io.emit("add new transactions", { data: res.rows });
              console.log({ data: res.rows });
            }
          );

          console.log("PENDING_TRANSACTIONS cleared");
          client.query(
            "DELETE FROM pending_transactions3 WHERE id IN (SELECT id FROM pending_transactions3 ORDER BY id LIMIT $1);",
            [blockSize],
            (err, res) => {
              if (err) throw err;
            }
          );

          console.log("BLOCKSIZE set to 0 again");
          blockSize = 0;
        }
      }
    );
  });

  socket.on("transaction", (transaction) => {
    console.log("NEW TRANSACTION received from: ", socket.id);
    console.log("NEW TRANSACTION received: ", transaction);
    client.query(
      "SELECT username FROM users3 where username = $1;",
      [transaction.to],
      (err, res) => {
        if (res.rowCount == 1) {
          io.to(socket.id).emit("transaction acknowledgement", {
            message: "Transaction added successfully",
          });
          console.log(res.rowCount);
          console.log(res);
          client.query(
            "INSERT INTO pending_transactions3 (from_add, to_add, amount) VALUES ($1, $2, $3);",
            [transaction.from, transaction.to, transaction.amount],
            (err, res) => {
              if (err) throw err;
              for (let row of res.rows) {
                console.log(JSON.stringify(row));
              }
            }
          );
        } else {
          console.log(res);
          io.to(socket.id).emit("transaction acknowledgement", {
            message: "The user does not exist",
          });
        }
      }
    );
  });

  socket.on("disconnect", (reason) => {
    console.log("USER DISCONNECTED: " + socket.id);
    console.log("REASON: ", reason);
  });

  socket.on("connect_error", (err) => {
    console.log(`connect_error due to ${err.message}`);
  });
});

server.listen(port, () => console.log("server running on port: " + port));
