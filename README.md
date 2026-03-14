# Docker Label Manager for Unraid

Welcome to **Docker Label Manager** (formerly `docker.labelInjector`), a powerful Unraid plugin designed to help you bulk add, update, and manage labels across your Docker containers.

## Features

- **Bulk Label Management:** Easily add or remove labels to multiple Docker containers at once.
- **Default Presets:** Out of the box, the plugin provides default configurations to quickly set up labels for popular applications:
  - **Nginx Proxy Manager Plus (NPM)**
  - **Homepage**
  - **AutoKuma**
- **Dynamic Variables:** Inject magic variables into your labels for dynamic configuration:
  - `${CONTAINER_NAME}`: Replaced with the container's exact name.
  - `${CONTAINER_NAME_LOWER}`: Replaced with the container's name in lowercase.
  - `${CONTAINER_PORT}`: Auto-detects and inserts the first internal port configured in the container.
- **Safe Operations:** Before making updates, the plugin backups the current XML template being used. If something goes wrong, you can quickly **Undo / Restore** directly from the UI or manually via `/boot/config/plugins/dockerMan/templates-user/my-TEMPLATE_NAME.DATE.bak`.
- **Live Preview:** See a real-time summary of the expected changes before committing them.
- **Unraid 7.2 Support:** Fully supports modern Unraid styling, including native Dark Mode.

## Installation

Install via Community Applications (CA Apps) by searching for "Docker Label Manager".

## Usage

1. Go to the Settings page and navigate to **LabelManager** to add your default labels that you want prefilled.
2. Navigate to your Docker tab and click the **Add Labels** button.
3. Select the containers you want to apply labels to, or choose "All".
4. Enter the Label Key and Label Value.
   - *Updating:* If the label exists, its value will be updated.
   - *Adding:* If the label doesn't exist, it will be added.
   - *Removing:* Leave the value empty (or enter `REMOVE`) to remove the label.
5. Review the Live Preview and apply!

## Credits

This project was built upon the fantastic foundation of the original [docker.labelInjector](https://github.com/phyzical/docker.labelInjector) by **[phyzical](https://github.com/phyzical)**. Huge thanks to them for the original concept and implementation!

Further developed, updated, and maintained by **Coryrichter94**.
