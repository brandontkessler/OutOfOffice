'use strict';
const path = require('path'),
  { User, Company } = require(path.join(process.cwd(), 'app', 'models')),
  { successHandler, errorHandler } = require(path.join(process.cwd(), 'app', 'helpers'))

const routeType = 'company-dashboards'

let getTeam = (req, res) => {
  Company.findById(req.params.companyId).populate('admin').populate('member').exec((err, foundCompany) => {
    if(err) errorHandler(err, req, res, routeType, 'getTeam')
    res.render('company-dashboards/team', {company: foundCompany})
  })
}

let leaveTeam = async (req, res) => {
  try {
    let foundUser = await User.findById(req.user.id)
    let foundCompany = await Company.findById(req.params.companyId)

    // CHECK IF USER IS MEMBER
    let userIsMember = foundUser.companiesAdmin.every(companyId => companyId.toString() !== foundCompany._id.toString())
    if(userIsMember){
      let companyIndex = foundCompany.member.indexOf(foundUser._id)
      let userIndex = foundUser.companiesMember.indexOf(foundCompany._id)

      foundCompany.member.splice(companyIndex, 1)
      foundCompany.notifications.unshift(`${foundUser.name.split(' ')[0]} has left the team`)
      foundUser.companiesMember.splice(userIndex, 1)

      await foundCompany.save()
      await foundUser.save()

      successHandler(req, res, routeType, 'leaveTeam')
    }

    // IF NOT MEMBER, THEN USER IS ADMIN
    let companyIndex = foundCompany.admin.indexOf(foundUser._id)
    let userIndex = foundUser.companiesAdmin.indexOf(foundCompany._id)

    foundCompany.admin.splice(companyIndex, 1)
    foundCompany.notifications.unshift(`${foundUser.name.split(' ')[0]} has left the team`)
    foundUser.companiesAdmin.splice(userIndex, 1)

    await foundCompany.save()
    await foundUser.save()

    successHandler(req, res, routeType, 'leaveTeam')
  } catch(e) {
    errorHandler(e, req, res, routeType, 'leaveTeam')
  }
}

let getInvitePage = async (req, res) => {
  try {
    let foundCompany = await Company.findById(req.params.companyId)
    let allUsers = await User.find({})
    res.render('company-dashboards/team/invite', {users: allUsers, company: foundCompany})
  } catch(e) {
    errorHandler(e, req, res, routeType, 'getInvitePage')
  }
}

let sendInvite = async (req, res) => {
  try {
    let foundUser = await User.findOne({ 'inviteCode': req.body.invitee })
    if(!foundUser) return errorHandler({message: "That user doesn't exist"}, req, res, routeType, 'sendInvite')

    let newInvite = req.body.invite

    let uniqueAdmin = foundUser.companiesAdmin.every(companyId => !companyId.equals(newInvite.companyId))
    let uniqueMember = foundUser.companiesMember.every(companyId => !companyId.equals(newInvite.companyId))
    let uniqueInvite = foundUser.invites.every(invite => invite.companyId !== newInvite.companyId)

    if(!uniqueAdmin){
      errorHandler({message: 'That user is already an admin'}, req, res, routeType, 'sendInvite')
    } else if (!uniqueMember){
      errorHandler({message: 'That user is already a team member'}, req, res, routeType, 'sendInvite')
    } else if (!uniqueInvite){
      errorHandler({message: 'There is already a pending invite to that user'}, req, res, routeType, 'sendInvite')
    } else {

      await foundUser.invites.push(newInvite)
      await foundUser.save()

      successHandler(req, res, routeType, 'sendInvite')
    }
  } catch(e) {
    errorHandler(e, req, res, routeType, 'sendInvite')
  }
}

let acceptInvite = async (req, res) => {
  try {
    let foundUser = await User.findById(req.user._id)
    let foundCompany = await Company.findById(req.params.companyId)
    let inviteArray = foundUser.invites

    for (let invite of inviteArray) {
      if(!foundCompany._id.equals(invite.companyId)){
        continue
      }
      if(invite.admin){
        foundUser.invites = foundUser.invites.filter(invite => !invite._id.equals(req.body.inviteId))
        foundUser.companiesAdmin.push(foundCompany)
        foundCompany.admin.push(req.user)
        foundCompany.notifications.unshift(`${req.user.name.split(' ')[0]} has accepted the invite`)

        await foundUser.save()
        await foundCompany.save()

        successHandler(req, res, routeType, 'acceptInvite')
      } else {
        foundUser.invites = foundUser.invites.filter(invite => !invite._id.equals(req.body.inviteId))
        foundUser.companiesMember.push(foundCompany)
        foundCompany.member.push(req.user)
        foundCompany.notifications.unshift(`${req.user.name.split(' ')[0]} has accepted the invite`)

        await foundUser.save()
        await foundCompany.save()

        successHandler(req, res, routeType, 'acceptInvite')
      }
    }
  } catch(e) {
    errorHandler(e, req, res, routeType, 'acceptInvite')
  }
}

let declineInvite = async (req, res) => {
  try {
    let foundUser = await User.findById(req.user._id)
    let foundCompany = await Company.findById(req.params.companyId)

    foundUser.invites = foundUser.invites.filter(invite => !invite._id.equals(req.body.inviteId))
    foundCompany.notifications.unshift(`${req.user.name.split(' ')[0]} has rejected the invite`)

    await foundUser.save()
    await foundCompany.save()

    successHandler(req, res, routeType, 'declineInvite')
  } catch(e) {
    errorHandler(e, req, res, routeType, 'declineInvite')
  }
}

let removeMemberPage = (req, res) => {
  Company.findById(req.params.companyId).populate('member').exec((err, foundCompany) => {
    if(err) errorHandler(err, req, res, routeType, 'removeMemberPage')
    res.render('company-dashboards/team/remove-member', {company: foundCompany})
  })
}

let removeMember = async (req, res) => {
  try {
    let membersToDelete = req.body.member
    let foundCompany = await Company.findById(req.params.companyId)

    if(typeof membersToDelete === "string"){
      let foundUser = await User.findById(membersToDelete)

      foundCompany.member = foundCompany.member.filter(member => !member.equals(foundUser._id))
      foundUser.companiesMember = foundUser.companiesMember.filter(company => !company.equals(foundCompany._id))
      foundCompany.notifications.unshift(`${foundUser.name.split(' ')[0]} has been removed`)

      await foundCompany.save()
      await foundUser.save()

      successHandler(req, res, routeType, 'removeMember')
    } else {
      foundCompany.notifications.unshift(`Members have been removed`)

      for (member of membersToDelete){
        let foundUser = await User.findById(member)

        foundCompany.member = foundCompany.member.filter(memberId => !memberId.equals(foundUser._id))
        foundUser.companiesMember = foundUser.companiesMember.filter(companyId => !companyId.equals(foundCompany._id))

        await foundCompany.save()
        await foundUser.save()

        successHandler(req, res, routeType, 'removeMember')
      }
    }
  } catch(e) {
    errorHandler(e, req, res, routeType, 'removeMember')
  }
}

module.exports = {
  getTeam,
  leaveTeam,
  getInvitePage,
  sendInvite,
  acceptInvite,
  declineInvite,
  removeMemberPage,
  removeMember
}
