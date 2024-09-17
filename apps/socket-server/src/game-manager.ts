import { WebSocket } from "ws"
import { ChessGame } from "./games/chess";
import { User } from "./games/user";
import { socketManager } from "./socket-manager";
import { GameMessages } from "@repo/chess/gameStatus";

export class GameManager {
  private games: ChessGame[];
  private pendingGameId: string | null;
  private users: User[];

  constructor() {
    this.games = [];
    this.pendingGameId = null;
    this.users = [];
  }

  addUser(user: User) {
    this.users.push(user);
    this.addHandler(user);
  }

  removeUser(socket: WebSocket) {
    const user = this.users.find((user: User) => user.socket === socket);

    if (!user) {
      console.log("remove User User not found");
      return;
    }

    console.log("user found")
    this.users = this.users.filter((user: User) => user.socket !== socket);
    socketManager.removeUser(user.id);
  }

  private addHandler(user: User) {
    user.socket.on("message", (data) => {
      const { event, payload } = JSON.parse(data.toString());

      if (event === GameMessages.INIT_GAME) {
        if (this.pendingGameId) {
          const game: ChessGame | undefined = this.games.find((game: ChessGame) => game.id === this.pendingGameId);
          if (!game) {
            console.error("Pending game not found");
            return;
          }
          // players can join the game again if the game isn't over
          if (user.id === game.player1UserId) {
            console.error("The user is already in the room")
            return;
          }

          socketManager.addUser(user, game.id);

          // afte the pending to fill, it needs to be assigned to null
          game.addSecondPlayer(user.id);
          this.pendingGameId = null;
        } else {
          console.log("create a new game")
          const game: ChessGame = new ChessGame(user.id);
          this.pendingGameId = game.id;
          this.games.push(game);

          socketManager.addUser(user, game.id);
          socketManager.broadcast(
            game.id,
            JSON.stringify({
              event: GameMessages.GAME_ADDED,
              payload: {
                userId: user.id,
                gameId: game.id
              }
            })
          )
        }
      }

      if (event === GameMessages.MOVE) {
        const { gameId, move } = payload;
        const game: ChessGame | undefined = this.games.find((game: ChessGame) => game.id === gameId);

        if (!game) {
          console.error("Game not found");
          return;
        } else {
          // make a move here
          game.move(user, move);
          if (game.result) {
            this.removeGame(game.id);
          }
        }
      }

      if (event === GameMessages.TIMER) {
        const { gameId } = payload;
        const game: ChessGame | undefined = this.games.find((game: ChessGame) => game.id === gameId);

        if (!game) {
          console.error("Game not found");
          return;
        } else {
          // the timer is ended.
          game.gameTimer?.switchTurn();
          const { player1RemainingTime, player2RemainingTime } = game.gameTimer?.getPlayerTimes() || {};

          console.log("Timer end 1 ", player1RemainingTime, player2RemainingTime);
          game.timerEnd(player1RemainingTime, player2RemainingTime);
        }
      }
    })
  }

  private removeGame(gameId: string) {
    const game: ChessGame | undefined = this.games.find((game: ChessGame) => game.id === gameId);
    if (!game) {
      console.error("Game not found");
      return;
    } else {
      this.games = this.games.filter((game: ChessGame) => game.id !== gameId);
    }
  }
}
