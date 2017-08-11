import React, { Component } from 'react'
import Dialog from 'material-ui/Dialog'
import FlatButton from 'material-ui/FlatButton'
import {List, ListItem} from 'material-ui/List'
import Subheader from 'material-ui/Subheader'
import Divider from 'material-ui/Divider'
import CommunicationChatBubble from 'material-ui/svg-icons/communication/chat-bubble'
import TextField from 'material-ui/TextField'
import IconButton from 'material-ui/IconButton'
import MoreVertIcon from 'material-ui/svg-icons/navigation/more-vert'
import NewIcon from 'material-ui/svg-icons/content/gesture'
import DelIcon from 'material-ui/svg-icons/maps/directions-walk'
import WLIcon from 'material-ui/svg-icons/av/playlist-add-check'
import BadgeIcon from 'material-ui/svg-icons/av/new-releases'
import {pinkA200, grey400} from 'material-ui/styles/colors'
import Yes from 'material-ui/svg-icons/toggle/check-box'
import No from 'material-ui/svg-icons/toggle/check-box-outline-blank'
import Maybe from 'material-ui/svg-icons/toggle/indeterminate-check-box'
import Checkbox from 'material-ui/Checkbox'
import Avatar from 'material-ui/Avatar'

/**
 * Channels list view.
 */
export default class Channels extends Component {
  constructor(props) {
    super(props)
    this.state = {
      value: '', // value of new channel input field
      open: false, // new channel dialog
      openwl: false, // whitelist
    }
  }

  // open modals
  handleOpen = (wl) => {
    if (wl)
      this.setState({ openwl: true })
    else
      this.setState({ open: true })
  }

  // close modals
  handleClose = () => {
    this.setState({ value: '', open: false, openwl: false });
  }

  // on type in new channel input field
  onChange = (e, value) => {
    this.setState({ value: value })
  }

  // detect enter key press in new channel input field
  onKeyDown = (e) => {
    if (e.key == 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.onNew()
    }
  }

  // user requests to add a new channel
  onNew = () => {
    if (this.state.value) {
      this.props.onNew(this.state.value)
      this.setState({ open: false, value: '' })
    }
  }

  // render the list/nav
  render() {
      let channels = Object.keys(this.props.channels).map((item, index) => {
          let text = item.replace(/\b\w/g, l => l.toUpperCase())
          let style = Object.assign({}, this.props.channel == item && { fontWeight: 'bold' })

          let icon = <CommunicationChatBubble />

          let iconButtonElement = (
            <IconButton touch={true} >
              <MoreVertIcon color={grey400} />
            </IconButton>
          );

          //let rightIconMenu = (
          //    <IconMenu iconButtonElement={iconButtonElement}>
          //        <MenuItem onTouchTap={this.props.onDel.bind(null, item)}>Delete</MenuItem>
          //    </IconMenu>
          //);

          return (
              <ListItem
                  key={index}
                  leftAvatar={<Avatar>{text.charAt(0)}</Avatar>}
                  //rightIconButton={rightIconMenu}
                  onTouchTap={this.props.onSet.bind(null, item)}
                  primaryText={<span style={style}>{text}</span>}
                  //secondaryText={
                  //  <p>
                  //    <span style={{color: darkBlack}}>Brendan Lim</span> --
                  //    I&apos;ll be in your neighborhood doing errands this weekend. Do you want to grab brunch?
                  //  </p>
                  //}
                  //secondaryTextLines={2}
              />
          );
      })

      var indicate = false, whitelist = Object.keys(this.props.whitelist).map((item, i) => {
				var val = this.props.whitelist[item]
				var checked = val == 1	
				var def = <No />

				if (val == 2) {
					def = <Maybe />
					indicate = true
				}

        return <div key={i} style={styles.row}>
					{item}
  				 <Checkbox
						 style={styles.checkbox}
					   checked={checked}
  				   checkedIcon={<Yes />}
  				   uncheckedIcon={def}
						 onCheck={(e, checked) => { this.props.toggle(item, checked) }}
  				 />
				</div> 
      })

			var badge = indicate ? <BadgeIcon color={pinkA200}/> : null

      const actions = [
          <FlatButton
              label="Cancel"
              primary={true}
              onTouchTap={this.handleClose}
          />,
          <FlatButton
              label="Add"
              primary={true}
              keyboardFocused={true}
              onTouchTap={this.onNew}
          />,
      ]

      return (
          <div>
              <List>
                  <Subheader>Channels</Subheader>
                  {channels}
                  <Divider />
                  <ListItem
                      primaryText="New channel"
                      leftIcon={<NewIcon style={styles.icon}/>}
                      onTouchTap={() => { this.handleOpen(false) }}
                  />
                  <ListItem
                      primaryText="Whitelist"
                      leftIcon={<WLIcon style={styles.icon}/>}
                      onTouchTap={() => { this.handleOpen(true) }}
											rightIcon={badge}
                  />
                  <ListItem
                      primaryText="Logout"
                      leftIcon={<DelIcon style={styles.icon}/>}
                      onTouchTap={this.props.logout}
                  />
              </List>
              <Dialog
                  title="New channel"
                  actions={actions}
                  modal={false}
                  open={this.state.open}
                  onRequestClose={this.handleClose}
              >
                  <TextField
                      hintText="Channel name"
                      fullWidth={true}
                      value={this.state.value}
                      onChange={this.onChange}
                      onKeyDown={this.onKeyDown}
                  />
              </Dialog>
              <Dialog
                  title="Whitelist"
                  actions={
                    <FlatButton
                        label="Cancel"
                        primary={true}
                        onTouchTap={this.handleClose}
                    />
                  }
                  modal={false}
                  open={this.state.openwl}
                  onRequestClose={this.handleClose}
              >
                  {whitelist}
              </Dialog>
          </div>
      );
  }
}

const styles = {
  icon: {
    transform: 'scale(1)',
    margin: '12px 0 0 20px',
  },
	checkbox: {
		float: 'right',
		width: 'auto',
	},
	row: {
		padding: '10px 0',
	}
}

