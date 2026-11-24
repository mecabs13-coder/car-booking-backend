
const { deleteImageFile } = require("../config/Helper");
const Setting = require("../model/SettingModel");

const SettingController = {
    index: async (req, res) => {
        try {
            const setting = await Setting.findOne();

            if (setting) {
                if (setting.logo) {
                    setting.logo = `${process.env.IMAGE_URL}setting/${setting.logo}`;
                }

                if (setting.favicon) {
                    setting.favicon = `${process.env.IMAGE_URL}setting/${setting.favicon}`;
                }
            }

            res.json(setting);
        } catch (error) {
            console.log(error);
            res.status(500).json({ error: error.message });
        }
    },

    update: async (req, res) => {
        try {
            const {
                contactNo1,
                contactNo2,
                email,
                address,
                Instagram,
                facebook,
                WhatsApp
            } = req.body;

            const settingdata = {
                contactNo1,
                contactNo2,
                email,
                address,
                Instagram,
                facebook,
                WhatsApp
            };

            const setting = await Setting.findOne();

            // Handle uploaded logo and favicon
            if (req.files?.logo?.[0]) {
                settingdata.logo = req.files.logo[0].filename;

                if (setting?.logo) {
                    await deleteImageFile("setting", setting.logo);
                }
            }

            if (req.files?.favicon?.[0]) {
                settingdata.favicon = req.files.favicon[0].filename;

                if (setting?.favicon) {
                    await deleteImageFile("setting", setting.favicon);
                }
            }

            if (setting) {
                await Setting.findByIdAndUpdate(
                    setting._id,
                    { $set: settingdata },
                    { new: true, runValidators: true }
                );
            } else {
                const newSetting = new Setting(settingdata);
                await newSetting.save();
            }

            res.json({ message: "Setting Updated successfully" });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
};

module.exports = SettingController;
