import React, { Component } from 'react'
import { shell } from 'electron'
import { List, ListItem } from 'material-ui/List'
import Subheader from 'material-ui/Subheader'
import ContentInbox from 'material-ui/svg-icons/content/inbox'
import ActionGrade from 'material-ui/svg-icons/action/grade'
import Dialog from 'material-ui/Dialog'
import FlatButton from 'material-ui/FlatButton'
import RaisedButton from 'material-ui/RaisedButton'
import TextField from 'material-ui/TextField'
import LinearProgress from 'material-ui/LinearProgress'
import Snackbar from 'material-ui/Snackbar'
import { redA200 } from 'material-ui/styles/colors'

// verify functions to interact with services
import { register, verifyGithubAccount } from './verify'

// compact uuid implementation
const uuid = () => +new Date + '' //uuid=(a,b)=>{for(b=a='';a++<36;b+=a*51&52?(a^15?8^Math.random()*(a^20?16:4):4).toString(16):'-');return b}

/**
 * Login view.
 */
export default class Login extends Component {
  constructor(props) {
    super(props)
    this.id = uuid().replace(/-/g, '') // todo
    this.state = {
      work: false,
      error: '',
      email: { // state for the email dialog
        open: false,
        value: '',
      },
      github: { // state for the github dialog
        open: false,
        value: '',
      },
    }
  }

  // Display error text and later hide it.
  handleError = (err) => {
    if (this.state.work) {
      this.setState({ error: err, work: false })
		  setTimeout(this.setState.bind(this, { error: '' }), 4000)
    }
  }

  // Perform email registration (or login if already reg) flow.
  submitEmail = async () => {
    const email = this.state.email.value

    try {
      this.setState({ work: true })
      await register(this.id, email)
      this.props.onLogin(this.id, email)
    } catch (err) {
      this.handleError(err)
    }
  }

  // Perform github login flow.
  submitGithub = async () => {
    const username = this.state.github.value

    this.state.work = true
    this.setState(this.state)

    while (this.state.work)
      try {
        if (await verifyGithubAccount(this.id, username))
          break
        await new Promise(ok => setTimeout(ok, 3000)) 
      } catch (err) {
        this.handleError(err)
      }
    if (this.state.work)
      this.props.onLogin(this.id, 'gh:' + username)
  }

  // close what ever dialog open
  close = () => {
    let state = this.state
    for (let which of [ 'email', 'github' ])
      state[which].open = false
    state.error = ''
    state.work = false
    this.setState(state)
  }

  // open some dialog
  open(which) {
    let state = this.state
    state[which].open = true
    state[which].value = ''
    this.setState(state)
  }

  // change of the value of some dialog
  change(which, e, value) {
    let state = this.state
    state[which].value = value
    this.setState(state)
  }

  // detect enter key press
  press(submit, e) {
    if (e.key == 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  // open github profile in default browser
  openGithubProfile() {
    shell.openExternal('https://github.com/settings/profile') 
  }

  // render the view and possibly a dialog
  render() {
		const work = this.state.work && (
			<LinearProgress 
				color={redA200}
				style={styles.work} 
			/>
		)
    const actions = (yes, no)  => [
      <FlatButton
        label="Cancel"
        primary={true}
        onTouchTap={no}
      />,
      <FlatButton
        label="Add"
        primary={true}
        keyboardFocused={true}
        onTouchTap={yes}
      />,
    ]
    const actionGotoGithubProfile =
      <FlatButton
        label="Goto profile"
        primary={true}
        onTouchTap={this.openGithubProfile}
      />

    const dialogEmail = this.state.work ?
      <p>Check your inbox and follow the instructions.</p> :
      <TextField
        fullWidth={true}
        hintText="Email address"
        value={this.state.email.value}
        onChange={this.change.bind(this, 'email')}
        onKeyDown={this.press.bind(this, this.submitEmail)}
      />
    const dialogGithub = this.state.work ?
      <div>
        <p>Append this code to your github bio, then get back here.</p>
        <code>{this.id}</code>
      </div> :
      <TextField
        fullWidth={true}
        hintText="Github username"
        value={this.state.github.value}
        onChange={this.change.bind(this, 'github')}
        onKeyDown={this.press.bind(this, this.submitGithub)}
      />
    let actionsGithub = actions(this.submitGithub, this.close)
    if (this.state.work)
      actionsGithub.unshift(actionGotoGithubProfile)
      
    return (<div>
			{work}
      <Snackbar
       open={!!this.state.error}
       message={this.state.error}
      />
      <List>
        <Subheader>Bring your own ID</Subheader>
        <ListItem primaryText="Email Address" leftIcon={<ContentInbox />} onTouchTap={this.open.bind(this, 'email')}/>
        <ListItem primaryText="Github Account" leftIcon={<ActionGrade />} onTouchTap={this.open.bind(this, 'github')}/>
      </List>
      <Dialog
        modal={false}
        title="Login with email address"
        actions={actions(this.submitEmail, this.close)}
        open={this.state.email.open}
        onRequestClose={this.close}
      >
      {dialogEmail}
      </Dialog>
      <Dialog
        modal={false}
        title="Login with github account"
        actions={actionsGithub}
        open={this.state.github.open}
        onRequestClose={this.close}
      >
      {dialogGithub}
      </Dialog>
    </div>)
  }
}

const styles = {
	work: {
		position: 'absolute',
		top: 0,
		left: 0,
		zIndex: 2000,
	}
}
