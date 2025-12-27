# mypage Specification

## Purpose
TBD - created by archiving change feat-app-cast-mypage. Update Purpose after archive.
## Requirements
### Requirement: MyPage View
The system MUST provide a comprehensive MyPage view for authenticated Cast users.

#### Scenario: Display Stats
Given an authenticated Cast user
When they access the MyPage (`/cast/mypage`)
Then they see their key performance metrics: "Total Sales", "Followers count", and "Promise Rate".

#### Scenario: Display Management Menu
Given a Cast user on MyPage
When they scroll down
Then they see a list of management options including "Profile Edit", "Followers List", "Invitation Plans", and "Block List".

### Requirement: Logout Functionality
The system MUST allow Cast users to log out from MyPage.

#### Scenario: Logout
Given a Cast user on MyPage
When they click the "Logout" button
Then their session is terminated
And they are redirected to the login page.

