import React, { Component } from 'react'
import TextField from 'material-ui/TextField'
import FlatButton from 'material-ui/FlatButton'
import Dialog from 'material-ui/Dialog'
import SelectField from 'material-ui/SelectField'
import MenuItem from 'material-ui/MenuItem'
import {Toolbar, ToolbarGroup, ToolbarSeparator, ToolbarTitle} from 'material-ui/Toolbar'
import Chip from 'material-ui/Chip'
import IconMenu from 'material-ui/IconMenu'
import IconButton from 'material-ui/IconButton'
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert'

/**
 * Feed view.
 */
const Feed = (props) => {
    let last, key = 0, feed = []
    for (let { name, text } of props.messages) {
      if (name !== last)
        feed.push(
          <p key={key++} style={styles.recipient}>{last = name}</p>
        )
      feed.push(
        <div key={key++} style={Object.assign({}, styles.bubble, name && styles.bubble_recipient)}>
          <p style={styles.message}>{text}</p>
        </div>
      )
    }
    return (
      <div style={styles.feed}>
        <div>
          {feed}
        </div>
      </div>
    )
}

/**
 * Chat view.
 * Handles add and remove of members in channels.
 */
export default class Chat extends Component {
  constructor(props) {
    super(props)
    this.state = {
      value: '',
      is_typing: false,
      dialog: {
        open: false,
				provider: 0,
        identity: '',
      },
    }
  }

  onChange = (e, value) => {
    this.setState({ value: value })
  }
  onKeyDown = (e) => {
    if (e.key == 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (this.state.value) {
        this.props.onMessage(this.state.value)
        this.setState({ value: '' })
      }
    }
  }

  dialogOpen = (open) => {
    this.state.dialog.open = open
    this.setState(this.state)
  }
  dialogChangeIdentity = (e, value) => {
    this.state.dialog.identity = value
    this.setState(this.state)
  }
  dialogChangeProvider = (e, value) => {
    this.state.dialog.provider = value
    this.setState(this.state)
  }
  dialogPress = (submit, e) => {
    if (e.key == 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }
  dialogSubmit = (member) => {
    const prefix = ['', 'gh:'][this.state.dialog.provider]
    const id = prefix + this.state.dialog.identity
    this.props.onAddMember(id)
    this.state.dialog.identity = ''
    this.state.dialog.open = false
    this.setState(this.state)
  }

  render() {
    const chips = this.props.members.map((item, i) => ( 
        <Chip
          key={i}
          style={styles.chip}
          onRequestDelete={this.props.onDelMember.bind(null, item)}
        >
          {item}
        </Chip>
      )
    )
    
    return (
      <div style={styles.cont}>
        <div style={styles.bar}>
          <IconMenu style={styles.menu}
            iconButtonElement={<IconButton><MoreVertIcon /></IconButton>}
            anchorOrigin={{horizontal: 'left', vertical: 'top'}}
            targetOrigin={{horizontal: 'left', vertical: 'top'}}
          >
            <MenuItem primaryText="Add member" onTouchTap={this.dialogOpen.bind(this, true)}/>
          </IconMenu>
          {chips}
        </div>
        <div style={styles.main}>
          <Feed
            messages={this.props.messages}
            isTyping={this.state.is_typing}
          />
        </div>
        <div style={styles.end}>
          <TextField
            hintText="Message Field"
            multiLine={true}
            fullWidth={true}
            underlineShow={false}
            value={this.state.value}
            onChange={this.onChange}
            onKeyDown={this.onKeyDown}
          />
        </div>
        <Dialog
          modal={false}
          title="Add member"
          actions={
            <FlatButton
              label="Add"
              primary={true}
              keyboardFocused={true}
              onTouchTap={this.dialogSubmit}
            />
          }
          open={this.state.dialog.open}
          onRequestClose={this.dialogOpen.bind(this, false)}
        >
  				<Toolbar style={{ background: 'transparent' }}>
  				  <ToolbarGroup firstChild={true} lastChild={true}>
              <SelectField value={this.state.dialog.provider} onChange={this.dialogChangeProvider}>
                <MenuItem value={0} primaryText="Email" />
                <MenuItem value={1} primaryText="Github" />
              </SelectField>
          		<TextField
          		  hintText="Id"
          		  value={this.state.dialog.identity}
          		  onChange={this.dialogChangeIdentity}
          		  onKeyDown={this.dialogPress.bind(this, this.dialogSubmit)}
              />
  				  </ToolbarGroup>
  				</Toolbar>
        </Dialog>
      </div>
    )
  }
}

const styles = {
  // chat
  cont: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  main: {
    flexGrow: 1,
    position: 'relative', // hack to allow child to have height 100%
  },
  end: {
    maxHeight: 200,
    padding: '0 10px',
    overflow: 'scroll',
    borderTop: 'solid 1px #eee',
  },
  bar: {
    padding: 10,
    borderBottom: 'solid 1px #eee',
  },
  menu: {
    float: 'right',
    marginTop: -5,
    marginRight: -10,
    marginBottom: -5,
  },
  chip: {
    float: 'left',  
    margin: 2,
  },
  // feed //
  feed: {
    position: 'absolute', // hack since bug cannot use height: 100%
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: '10px 0',
    display: 'flex',
    //justifyContent: 'flex-end',    // breaks overflow scroll, instead:
    flexDirection: 'column-reverse', // + wrap bubbles in div = align bottom
    overflow: 'scroll',
  },
  recipient: {
    float: 'left',
    clear: 'both',
    margin: '0 0 0 10px',
    fontSize: 12,
    color: '#aaa',
  },
  // bubble //
  bubble: {
    clear: 'both',
    float: 'right',
    width: '-webkit-fit-content',
    maxWidth: 200,
    margin: '1px 10px',
    padding: '8px 14px',
    borderRadius: 20,
    background: "#2196F3",
    color: 'white',
  },
  bubble_recipient: {
    float: 'left',
    background: '#eee',
    color: '#212121',
  },
  message: {
    margin: 0,
    fontSize: 16,
    fontWeight: 300,
  }
}
