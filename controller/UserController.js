const User = require("../model/UserModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const OtpSendEmailContent = require("../emailContent/OtpSendEmailContent");
const { SendEmail } = require("../services/emailService");

const sendResetOtpEmail = async (user, otp) => {
  const htmlContent = OtpSendEmailContent({
    name: user.name,
    otp,
    expiry: 10,
  });

  await SendEmail(OtpSendEmailContent, EmailData);
};

const userController = {
  TestAPI: async (req, res) => {
    try {
      const users = await User.find().select("name");
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  adminLogin: async (req, res) => {
    try {
      const { email, password } = req.body;

      // Validation
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: "Please provide email and password",
        });
      }

      // Check if user exists and is admin (role: 1)
      const admin = await User.findOne({
        email: email,
        role: 1, // 1 for Admin
        isActive: true,
        isDeleted: false,
      });

      if (!admin) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials or you're not authorized as admin",
        });
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, admin.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: admin._id,
          email: admin.email,
          role: admin.role,
          name: admin.name,
        },
        process.env.JWT_KEY, // Use environment variable in production
        { expiresIn: "7d" },
      );

      // Remove password from response
      const adminResponse = admin.toObject();
      delete adminResponse.password;

      res.status(200).json({
        success: true,
        message: "Admin login successful",
        token,
        userData: adminResponse,
      });
    } catch (error) {
      console.error("Admin login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  driverLogin: async (req, res) => {
    try {
      const { email, mobile, password } = req.body;

      // Validation - can login with either email or mobile
      if ((!email && !mobile) || !password) {
        return res.status(400).json({
          success: false,
          message: "Please provide either email or mobile, and password",
        });
      }

      // Build query based on provided credentials
      let query = {
        role: 2, // 2 for Driver
        isActive: true,
      };

      if (email) {
        query.email = email;
      } else if (mobile) {
        query.mobile = mobile;
      }

      // Check if driver exists
      const driver = await User.findOne(query);

      if (!driver) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials or you're not authorized as driver",
        });
      }

      // Compare password
      const isPasswordValid = await bcrypt.compare(password, driver.password);

      if (!isPasswordValid) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials" });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: driver._id,
          email: driver.email,
          mobile: driver.mobile,
          role: driver.role,
          name: driver.name,
        },
        process.env.JWT_KEY, // Use environment variable in production
        { expiresIn: "7d" },
      );

      // Remove password from response
      const driverResponse = driver.toObject();
      delete driverResponse.password;

      res.status(200).json({
        success: true,
        message: "Driver login successful",
        token,
        userData: driverResponse,
      });
    } catch (error) {
      console.error("Driver login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  forgetPassword: async (req, res) => {
    try {
      const { email, otp, newPassword, confirmPassword, role } = req.body;

      if (!email || role === undefined || role === null) {
        return res.status(400).json({
          success: false,
          message: "Email and role are required",
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Find account according to email and role
      const user = await User.findOne({
        email: normalizedEmail,
        role: Number(role),
        isActive: true,
        isDeleted: false,
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User doesn't exist",
        });
      }

      // STEP 1: Generate and send OTP
      if (!otp) {
        const generatedOTP = crypto.randomInt(100000, 1000000);

        user.otp = generatedOTP;
        user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await user.save();

        const EmailData = {
          name:
            user.name ||
            `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          email: user.email,
          subject: "Forget Password - OTP Verification",
          otp: generatedOTP,
          expiry: 10,
        };

        try {
          await SendEmail(OtpSendEmailContent, EmailData);
        } catch (emailError) {
          user.otp = null;
          user.otpExpiresAt = null;
          await user.save();

          console.error("OTP email error:", emailError);

          return res.status(500).json({
            success: false,
            message: "Failed to send OTP. Please try again.",
          });
        }

        return res.status(200).json({
          success: true,
          message: "OTP sent to your registered email",
        });
      }

      // STEP 2: Verify OTP
      if (!user.otp || !user.otpExpiresAt) {
        return res.status(400).json({
          success: false,
          message: "Please request a new OTP",
        });
      }

      if (Date.now() > new Date(user.otpExpiresAt).getTime()) {
        user.otp = null;
        user.otpExpiresAt = null;
        await user.save();

        return res.status(400).json({
          success: false,
          message: "OTP has expired. Please request a new OTP.",
        });
      }

      if (String(otp) !== String(user.otp)) {
        return res.status(400).json({
          success: false,
          message: "OTP doesn't match",
        });
      }

      // STEP 3: OTP verified, but password not submitted yet
      if (!newPassword) {
        return res.status(200).json({
          success: true,
          message: "OTP verified successfully",
        });
      }

      // STEP 4: Validate and update password
      if (!confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Confirm password is required",
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          success: false,
          message: "Passwords do not match",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      user.password = hashedPassword;
      user.otp = null;
      user.otpExpiresAt = null;

      await user.save();

      return res.status(200).json({
        success: true,
        message: "Password updated successfully. Please login.",
      });
    } catch (error) {
      console.error("Forget password error:", error);

      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
};

module.exports = userController;
