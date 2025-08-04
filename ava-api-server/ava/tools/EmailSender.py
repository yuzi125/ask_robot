from exchangelib import DELEGATE, Account, Configuration, Credentials, Message
from openai import AsyncOpenAI

from ..utils import utils

compose_polite_email_prompt = '''
 You are a polite customer service staff, the next content I will give you is to reply to the customer's email content, 
 please rewrite the 'User Input' in a "gentle and polite" tone and in Traditional Chinese Language. Email signature is 'Stephen Tang'

 User Input: $PROMPT
 
'''


def compose_and_send_mail(body):
    better_content = compose_email(body)
    send_email("關於OA系統操作問題回覆", better_content)
    return better_content


def send_email(subject, body):
    exchange_server = 'mail.icsc.com.tw/EWS/Exchange.asmx'
    # exchange_server = 'mail.icsc.com.tw/mapi/emsmdb/?MailboxId=9f93693b-d743-4630-8085-d5aad897561f@icsc.com.tw'
    # Set up connection configuration
    config = Configuration(server=exchange_server, credentials=Credentials('I20496', utils.get_key('ICSC_MAIL_PWD')))

    # Connect to the Exchange Server
    account = Account(primary_smtp_address='saihong@icsc.com.tw', autodiscover=False, config=config,
                      access_type=DELEGATE)

    # Create a new email message
    email = Message(account=account, subject=subject, body=body,
                    to_recipients=['ichamps.reader@gmail.com'])

    # Send the email
    email.send_and_save()


def compose_email(user_contents):
    # protect
    if len(user_contents) < 30:
        raise ValueError("Inference Error")

    client = AsyncOpenAI()
    prompt = compose_polite_email_prompt.replace("$PROMPT", user_contents)
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "user", "content": prompt}
        ],
        max_tokens=800
    )
    body = response.choices[0].message.content
    return body
