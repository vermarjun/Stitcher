export function Map(){
  return (
    <div>
      <iframe src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3695.932488887924!2d82.13642730627775!3d22.128549593086973!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a280befca3a0d2f%3A0x580096dff518fe20!2sGuru%20Ghasidas%20Vishwavidyalaya%2C%20Bilaspur!5e0!3m2!1sen!2sin!4v1738605187853!5m2!1sen!2sin" width="650" height="550" allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"></iframe>
    </div>
  )
}
import { Input } from "@/Components/ui/input";
import { Textarea } from "@/Components/ui/textarea";
import { Button } from "@/Components/ui/button";

export function FeedbackForm() {
  return (
    <div className="w-full h-full">
      <h2 className="text-2xl font-bold text-neutral-950">Feedback</h2>
      <p className="text-md text-neutral-800 mb-2">We value your suggestions</p>
      
      <form className="space-y-2">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-neutral-700">Name</p>
          <Input 
            type="text" 
            name="name" 
            placeholder="Your Name" 
            className="border-black focus:ring-0"
          />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-neutral-700">Email</p>
          <Input 
            type="email" 
            name="email" 
            placeholder="Your Email" 
            className="border-black focus:ring-0"
          />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-sm text-neutral-700">Message</p>
          <Textarea 
            name="message" 
            placeholder="Enter your message" 
            className="border-black focus:ring-0 h-52"
          />
        </div>
    
          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white">
            Submit
          </Button>
      </form>
    </div>
  );
}


export default function Location (){
    return (
        <div className="flex flex-col justify-start items-start w-screen h-fit mb-24">
            <div className="px-24 py-8">
              <p className="font-bold text-4xl">Reach Us</p>
            </div>
            <div className="flex justify-center items-center px-24 gap-5 w-full h-fit">
              <div className="w-fit h-fit ">
                  <Map/>
              </div>
              <div className="px-8 w-full h-fit flex flex-col justify-start items-start shadow-lg rounded-lg bg-green-50 py-8">
                  <FeedbackForm/>
              </div>
            </div>
        </div>
    )
}