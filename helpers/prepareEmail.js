const adminModel = require("../../admin/model");

function structureTheEmail(recipientEmail, subject, html) {
  return {
    from: "<noreply@example.com>", // sender address
    to: recipientEmail, // list of receivers
    subject: subject, // Subject line
    html,
  };
}

function acknowledgeEmailBody(data) {
  return {
    from: "<noreply@example.com>", // sender address
    to: data.email, // list of receivers
    subject: "Thank you for joining relevant", // Subject line
    // text: "Hello world?", // plain text body
    html: `
        <p>Hi <strong>${data.name}</strong>,</p>
        <p>Thank you for joining relevant, lets create a community by writing best review </p>
        <p>Regards</p>
        <p>relevant</p>
        <p>2022</p>`,
  };
}

function prepareEmailForForgetPassword(user, _) {
  let emailBody = {
    from: "<noreply@example.com>", // sender address
    to: user.email, // list of receivers
    subject: "Forget password", // Subject line
    // text: "Hello world?", // plain text body
    html: `
        <p>please copy and paste the provided OTP to your browser to reset your password</p>
        <h1> ${user.passwordOTP}</h1>
        <p>Regards</p>
        <p>relevant</p>
        <p>2022</p>`,
  };

  return emailBody;
}

function prepareEmailForRegisterSuccess(data) {
  var emaildata = {
    name: data.name,
    email: data.email,
  };
  const email = acknowledgeEmailBody(emaildata);
  return { email };
}

module.exports = {
  prepareEmailToInformSuperUserForBusinessReg,
  prepareEmailForForgetPassword,
  prepareEmailForRegisterSuccess,
  prepareSuccessEmailBusinessCreation,
  structureTheEmail,
};
