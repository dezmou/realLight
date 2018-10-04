import PouchDB from 'pouchdb-browser'
import * as global from '../common/global'
import PouchWrapper, { PouchConnexion } from "../common/pouchWrapper"
import { DirectCallClient } from './directCall'
import { genId } from '../common/utils'
/**
 * Propagande Client for browser
 */
export class PropagandeClient {
  private directCall: DirectCallClient
  private user?: user;
  private serverCallbacks: any;
  private openedFunctions: any;
  private pouchWraper: PouchWrapper;
  private notificationTable: PouchConnexion;
  private userTable?: PouchConnexion;
  private userNotifTable?: PouchConnexion;
  public appName: string;
  constructor(options?: {
    /**Your app name defined by your PropagandeServer */
    appName: string,
    /**Your PropagandeServer url default to localhost */
    propagandeServerUrl?: string;
    /**Your PropagandeServer port default to 5555 */
    propagandeServerPort?: number;
    /** url of couchDB  default to localhost*/
    couchUrl?: string,
    /** Port of couchDB  default to 5984*/
    couchPort?: number,
  }) {
    const paramsD: any = {
      ...{
        propagandeServerUrl: global.DEFAULT_PROPAGANDE_URL,
        propagandeServerPort: global.DEFAULT_PROPAGANDE_PORT,
        couchUrl: global.DEFAULT_COUCHDB_HOST,
        couchPort: global.DEFAULT_COUCHDB_PORT,
      },
      ...options
    }
    this.directCall = new DirectCallClient({
      port: paramsD.propagandeServerPort,
      url: paramsD.propagandeServerUrl,
    });
    this.appName = paramsD.appName;
    this.serverCallbacks = {};
    this.openedFunctions = {};
    this.pouchWraper = new PouchWrapper(this.getNewPouchDb, {
      url: paramsD.couchUrl,
      port: paramsD.couchPort
    });
    this.notificationTable = this.pouchWraper.getNewAnonymousPouchConnexion(`propagande_${this.appName}_${global.MAIN_NOTIFICATION_TABLE}`)
    this.notificationTable.watchChange((event: any) => {
      this.onCouchEvent(event.doc)
    })
  }


  /**
   * Called when couchDB change
   */
  private async onCouchEvent(doc: any) {
    if (doc.reason === "mainCall" || doc.reason === 'cibledCall' || doc.reason === 'groupCall') {
      if (this.openedFunctions[doc.name]) {
        try {
          await this.openedFunctions[doc.name](doc.params);
        } catch (error) {
          // ERROR WHILE EXECUTING FUNCTION
        }
      } else {
        // FUNCTION DOESN'T EXIST
      }
    }
  }

  /**
   * Return couchDb client
   */
  private getNewPouchDb(url: string) {
    return new PouchDB(url)
  }


  /**
   * Login as a registred user
   * @param user 
   */
  async login(user: user) {
    this.userTable = this.pouchWraper.getNewPouchConnexion(user, '_users')
    const userDB = await this.userTable.get(`org.couchdb.user:propagande_${this.appName}_${user.name}`)
    this.userNotifTable = this.pouchWraper.getNewPouchConnexion(user, `propagande_${this.appName}_user_${user.name}`)
    this.userNotifTable.watchChange(this.onCouchEvent.bind(this))
    for (let role of userDB.roles) {
      const rolePouchConnexion = this.pouchWraper.getNewPouchConnexion(user, `propagande_${this.appName}_group_${role}`)
      rolePouchConnexion.watchChange((event: any) => {
        this.onCouchEvent(event.doc)
      })
    }
  }


  /**
   * Call a a function that has been opened in propagandeServer 
   * @param functionName 
   * @param params 
   * @param callback 
   */
  callServer(functionName: string, params: any, callback?: Function) {
    const id = genId('call');
    this.directCall.emit({
      reason: 'call',
      functionName,
      params,
      id,
      user: this.user
    })
    if (callback) {
      this.serverCallbacks[id] = callback;
    }
  }

  /**
   * Make a function callable from backend initiative
   */
  openFunction(func: Function) {
    if (func.name === "") {
      throw new Error(`Anonymous function aren't openable`)
    }
    this.openedFunctions[func.name] = func;
  }
}